<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreCrawlerJobRequest;
use App\Models\CrawlerJob;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\View\View;
use Throwable;

class CrawlerJobController extends Controller
{
    public function index(): View
    {
        $jobs = CrawlerJob::query()
            ->with('story')
            ->orderByDesc('id')
            ->paginate(30);

        return view('cms.crawler_jobs.index', [
            'jobs' => $jobs,
            'crawlerTokenConfigured' => (string) config('crawler.internal_token') !== '',
        ]);
    }

    public function create(Request $request): View
    {
        $stories = Story::query()
            ->orderBy('title')
            ->get(['id', 'title', 'slug']);

        $prefill = null;
        $copyFromId = null;
        if ($request->filled('from')) {
            $fromJob = CrawlerJob::query()->find((int) $request->query('from'));
            if ($fromJob !== null) {
                $copyFromId = $fromJob->id;
                $prefill = [
                    'source_url' => '',
                    'chapter_links_selector' => $fromJob->chapter_links_selector,
                    'chapter_list_next_page_selector' => $fromJob->chapter_list_next_page_selector,
                    'chapter_title_selector' => $fromJob->chapter_title_selector,
                    'chapter_content_selector' => $fromJob->chapter_content_selector,
                    'story_id' => $fromJob->story_id,
                    'new_story_title' => $fromJob->new_story_title ?? '',
                    'max_chapters' => $fromJob->max_chapters,
                    'delay_seconds' => (string) $fromJob->delay_seconds,
                    'chapter_fetch_concurrency' => $fromJob->chapter_fetch_concurrency,
                ];
            }
        }

        return view('cms.crawler_jobs.create', [
            'stories' => $stories,
            'crawlerTokenConfigured' => (string) config('crawler.internal_token') !== '',
            'prefill' => $prefill,
            'copyFromId' => $copyFromId,
        ]);
    }

    public function store(StoreCrawlerJobRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $storyId = $validated['story_id'] ?? null;
        $newTitle = $storyId ? null : ($validated['new_story_title'] ?? null);

        $job = CrawlerJob::query()->create([
            'story_id' => $storyId,
            'new_story_title' => $newTitle,
            'source_url' => $validated['source_url'],
            'chapter_links_selector' => trim((string) ($validated['chapter_links_selector'] ?? '')),
            'chapter_list_next_page_selector' => trim((string) ($validated['chapter_list_next_page_selector'] ?? '')),
            'chapter_title_selector' => $validated['chapter_title_selector'],
            'chapter_content_selector' => $validated['chapter_content_selector'],
            'max_chapters' => array_key_exists('max_chapters', $validated) && $validated['max_chapters'] !== null
                ? (int) $validated['max_chapters']
                : null,
            'delay_seconds' => isset($validated['delay_seconds']) ? (float) $validated['delay_seconds'] : 1.5,
            'chapter_fetch_concurrency' => array_key_exists('chapter_fetch_concurrency', $validated) && $validated['chapter_fetch_concurrency'] !== null
                ? (int) $validated['chapter_fetch_concurrency']
                : null,
            'status' => CrawlerJob::STATUS_PENDING,
            'chapters_imported' => 0,
            'last_error' => null,
        ]);

        try {
            $this->pushCrawlerJobToRedis($job);
            $job->update(['status' => CrawlerJob::STATUS_QUEUED]);
        } catch (Throwable $e) {
            $job->update([
                'status' => CrawlerJob::STATUS_FAILED,
                'last_error' => 'Redis: '.$e->getMessage(),
            ]);

            return redirect()
                ->route('cms.crawler-jobs.create')
                ->withErrors(['redis' => 'Không đẩy được job lên Redis: '.$e->getMessage()])
                ->withInput();
        }

        return redirect()
            ->route('cms.crawler-jobs.index')
            ->with('status', 'Đã tạo job #'.$job->id.' và đưa vào hàng đợi Redis.');
    }

    public function resend(CrawlerJob $crawlerJob): RedirectResponse
    {
        $allowed = [
            CrawlerJob::STATUS_FAILED,
            CrawlerJob::STATUS_PENDING,
            CrawlerJob::STATUS_QUEUED,
            CrawlerJob::STATUS_COMPLETED,
        ];

        if (! in_array($crawlerJob->status, $allowed, true)) {
            return redirect()
                ->route('cms.crawler-jobs.index')
                ->withErrors(['resend' => 'Không gửi lại job đang processing (đợi worker xong hoặc đánh dấu failed).']);
        }

        try {
            $this->pushCrawlerJobToRedis($crawlerJob);
        } catch (Throwable $e) {
            return redirect()
                ->route('cms.crawler-jobs.index')
                ->withErrors(['redis' => 'Không đẩy được lên Redis: '.$e->getMessage()]);
        }

        $crawlerJob->update([
            'status' => CrawlerJob::STATUS_QUEUED,
            'last_error' => null,
        ]);

        return redirect()
            ->route('cms.crawler-jobs.index')
            ->with('status', 'Đã đẩy lại job #'.$crawlerJob->id.' lên Redis ('.config('crawler.redis_queue_list').').');
    }

    /**
     * @throws \JsonException
     */
    private function pushCrawlerJobToRedis(CrawlerJob $job): void
    {
        $payload = json_encode(['crawler_job_id' => $job->id], JSON_THROW_ON_ERROR);
        Redis::rPush(config('crawler.redis_queue_list'), $payload);
    }
}
