<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\CrawlerJob;
use App\Models\Story;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CrawlerInternalController extends Controller
{
    public function show(CrawlerJob $crawlerJob): JsonResponse
    {
        $chapterStart = max(1, (int) ($crawlerJob->chapter_start ?? 1));

        return response()->json([
            'data' => [
                'id' => $crawlerJob->id,
                'source_url' => $crawlerJob->source_url,
                'chapter_links_selector' => $crawlerJob->chapter_links_selector,
                'chapter_list_next_page_selector' => $crawlerJob->chapter_list_next_page_selector,
                'chapter_title_selector' => $crawlerJob->chapter_title_selector,
                'chapter_content_selector' => $crawlerJob->chapter_content_selector,
                'story_id' => $crawlerJob->story_id,
                'new_story_title' => $crawlerJob->new_story_title,
                'chapter_start' => $chapterStart,
                'max_chapters' => $crawlerJob->max_chapters,
                'delay_seconds' => $crawlerJob->delay_seconds,
                'chapter_fetch_concurrency' => $crawlerJob->chapter_fetch_concurrency,
                'status' => $crawlerJob->status,
                'chapters_imported' => $crawlerJob->chapters_imported,
            ],
        ]);
    }

    public function storeChapter(Request $request, CrawlerJob $crawlerJob): JsonResponse
    {
        if (in_array($crawlerJob->status, [CrawlerJob::STATUS_COMPLETED, CrawlerJob::STATUS_FAILED], true)) {
            abort(422, 'Job is finished.');
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
        ]);

        $content = Story::sanitizeChapterContent($data['content']);

        $outcome = null;
        DB::transaction(function () use ($crawlerJob, $data, $content, &$outcome): void {
            $locked = CrawlerJob::query()->whereKey($crawlerJob->id)->lockForUpdate()->firstOrFail();
            if (in_array($locked->status, [CrawlerJob::STATUS_COMPLETED, CrawlerJob::STATUS_FAILED], true)) {
                abort(422, 'Job is finished.');
            }

            if ($locked->story_id === null) {
                $title = $locked->new_story_title;
                if ($title === null || $title === '') {
                    abort(422, 'Job has no story_id and new_story_title is empty.');
                }
                $story = Story::query()->create([
                    'title' => $title,
                    'description' => null,
                    'genre' => null,
                    'serial_status' => 'ongoing',
                ]);
                $locked->forceFill(['story_id' => $story->id])->save();
            }

            $story = Story::query()->findOrFail($locked->story_id);
            $outcome = Chapter::createOrUpdateByTitleForStory($story, $data['title'], $content);

            if ($outcome['created']) {
                $locked->forceFill([
                    'chapters_imported' => ((int) $locked->chapters_imported) + 1,
                ])->save();
            }
        });

        $crawlerJob->refresh();

        if ($outcome === null) {
            abort(500, 'Crawler chapter outcome missing.');
        }

        $chapter = $outcome['chapter'];
        $created = $outcome['created'];

        return response()->json([
            'data' => [
                'chapters_imported' => $crawlerJob->chapters_imported,
                'story_id' => $crawlerJob->story_id,
                'chapter_id' => $chapter?->id,
                'chapter_created' => $created,
            ],
        ], $created ? 201 : 200);
    }

    public function updateStatus(Request $request, CrawlerJob $crawlerJob): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:processing,completed,failed'],
            'message' => ['nullable', 'string', 'max:10000'],
        ]);

        $crawlerJob->status = $data['status'];
        if ($data['status'] === CrawlerJob::STATUS_FAILED) {
            $crawlerJob->last_error = $data['message'] ?? 'Unknown error';
        } elseif ($data['status'] === CrawlerJob::STATUS_COMPLETED) {
            $crawlerJob->last_error = null;
        } elseif ($data['status'] === CrawlerJob::STATUS_PROCESSING) {
            $crawlerJob->last_error = null;
        }

        $crawlerJob->save();

        return response()->json([
            'data' => [
                'status' => $crawlerJob->status,
                'last_error' => $crawlerJob->last_error,
            ],
        ]);
    }
}
