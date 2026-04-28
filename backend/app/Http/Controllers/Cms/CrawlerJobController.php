<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreCrawlerJobRequest;
use App\Http\Requests\Cms\UpdateCrawlerJobRequest;
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
        $statusCounts = CrawlerJob::query()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->map(static fn ($count): int => (int) $count)
            ->all();

        $jobs = CrawlerJob::query()
            ->with('story')
            ->orderByDesc('id')
            ->paginate(30);

        return view('cms.crawler_jobs.index', [
            'jobs' => $jobs,
            'crawlerTokenConfigured' => (string) config('crawler.internal_token') !== '',
            'crawlerJobCount' => CrawlerJob::query()->count(),
            'crawlerStatusCounts' => $statusCounts,
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
                $prefill = self::prefillFromJob($fromJob, blankSourceUrl: true);
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

        // Parse multiple URLs (one per line)
        $sourceUrls = array_filter(
            array_map('trim', explode("\n", $validated['source_url'])),
            fn($url) => $url !== '' && filter_var($url, FILTER_VALIDATE_URL) !== false
        );

        if (empty($sourceUrls)) {
            return redirect()
                ->route('cms.crawler-jobs.create')
                ->withErrors(['source_url' => 'Cần nhập ít nhất một URL hợp lệ.'])
                ->withInput();
        }

        $jobsCreated = 0;
        $jobsQueued = 0;
        $errors = [];

        foreach ($sourceUrls as $sourceUrl) {
            $job = CrawlerJob::query()->create([
                'story_id' => $storyId,
                'new_story_title' => $newTitle,
                'source_url' => $sourceUrl,
                'chapter_links_selector' => trim((string) ($validated['chapter_links_selector'] ?? '')),
                'chapter_list_next_page_selector' => trim((string) ($validated['chapter_list_next_page_selector'] ?? '')),
                'chapter_title_selector' => $validated['chapter_title_selector'],
                'chapter_content_selector' => $validated['chapter_content_selector'],
                'max_chapters' => array_key_exists('max_chapters', $validated) && $validated['max_chapters'] !== null
                    ? (int) $validated['max_chapters']
                    : null,
                'chapter_start' => max(1, (int) ($validated['chapter_start'] ?? 1)),
                'delay_seconds' => isset($validated['delay_seconds']) ? (float) $validated['delay_seconds'] : 1.5,
                'chapter_fetch_concurrency' => array_key_exists('chapter_fetch_concurrency', $validated) && $validated['chapter_fetch_concurrency'] !== null
                    ? (int) $validated['chapter_fetch_concurrency']
                    : null,
                'status' => CrawlerJob::STATUS_PENDING,
                'chapters_imported' => 0,
                'last_error' => null,
            ]);

            $jobsCreated++;

            try {
                $this->pushCrawlerJobToRedis($job);
                $job->update(['status' => CrawlerJob::STATUS_QUEUED]);
                $jobsQueued++;
            } catch (Throwable $e) {
                $job->update([
                    'status' => CrawlerJob::STATUS_FAILED,
                    'last_error' => 'Redis: '.$e->getMessage(),
                ]);
                $errors[] = "Job #{$job->id}: {$e->getMessage()}";
            }
        }

        $message = "Đã tạo {$jobsCreated} job";
        if ($jobsQueued > 0) {
            $message .= ", {$jobsQueued} đẩy lên Redis";
        }
        if (! empty($errors)) {
            $message .= '. Lỗi: '.implode('; ', $errors);
        } else {
            $message .= '.';
        }

        $statusType = $jobsQueued > 0 ? 'status' : 'error';

        return redirect()
            ->route('cms.crawler-jobs.index')
            ->with($statusType, $message);
    }

    public function edit(CrawlerJob $crawlerJob): View|RedirectResponse
    {
        if ($crawlerJob->status === CrawlerJob::STATUS_PROCESSING) {
            return redirect()
                ->route('cms.crawler-jobs.index')
                ->withErrors(['edit' => 'Không sửa job đang processing (đợi worker xong hoặc đánh dấu failed).']);
        }

        $stories = Story::query()
            ->orderBy('title')
            ->get(['id', 'title', 'slug']);

        return view('cms.crawler_jobs.edit', [
            'job' => $crawlerJob,
            'stories' => $stories,
            'd' => self::prefillFromJob($crawlerJob, blankSourceUrl: false),
            'crawlerTokenConfigured' => (string) config('crawler.internal_token') !== '',
        ]);
    }

    public function update(UpdateCrawlerJobRequest $request, CrawlerJob $crawlerJob): RedirectResponse
    {
        if ($crawlerJob->status === CrawlerJob::STATUS_PROCESSING) {
            return redirect()
                ->route('cms.crawler-jobs.index')
                ->withErrors(['edit' => 'Không sửa job đang processing (đợi worker xong hoặc đánh dấu failed).']);
        }

        $validated = $request->validated();
        $storyId = $validated['story_id'] ?? null;
        $newTitle = $storyId ? null : ($validated['new_story_title'] ?? null);

        $crawlerJob->update([
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
            'chapter_start' => max(1, (int) ($validated['chapter_start'] ?? 1)),
            'delay_seconds' => isset($validated['delay_seconds']) ? (float) $validated['delay_seconds'] : 1.5,
            'chapter_fetch_concurrency' => array_key_exists('chapter_fetch_concurrency', $validated) && $validated['chapter_fetch_concurrency'] !== null
                ? (int) $validated['chapter_fetch_concurrency']
                : null,
            'last_error' => null,
        ]);

        return redirect()
            ->route('cms.crawler-jobs.index')
            ->with('status', 'Đã cập nhật job #'.$crawlerJob->id.'. Dùng «Gửi lại Redis» nếu muốn chạy lại với cấu hình mới.');
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

    /**
     * @return array<string, mixed>
     */
    private static function prefillFromJob(CrawlerJob $job, bool $blankSourceUrl): array
    {
        return [
            'source_url' => $blankSourceUrl ? '' : $job->source_url,
            'chapter_links_selector' => $job->chapter_links_selector,
            'chapter_list_next_page_selector' => $job->chapter_list_next_page_selector,
            'chapter_title_selector' => $job->chapter_title_selector,
            'chapter_content_selector' => $job->chapter_content_selector,
            'story_id' => $job->story_id,
            'new_story_title' => $job->new_story_title ?? '',
            'max_chapters' => $job->max_chapters,
            'chapter_start' => $job->chapter_start ?? 1,
            'delay_seconds' => (string) $job->delay_seconds,
            'chapter_fetch_concurrency' => $job->chapter_fetch_concurrency,
        ];
    }
}
