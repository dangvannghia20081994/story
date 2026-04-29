<?php

namespace App\Services;

use App\Models\Chapter;
use App\Models\CrawlerJob;
use App\Models\Story;
use Illuminate\Support\Facades\DB;

final class CrawlerJobService
{
    /**
     * Ghi chương từ crawler (transaction + lock job).
     *
     * @return array{chapter: Chapter, created: bool}
     */
    public function storeChapter(CrawlerJob $crawlerJob, string $title, string $sanitizedContent): array
    {
        $outcome = null;
        DB::transaction(function () use ($crawlerJob, $title, $sanitizedContent, &$outcome): void {
            $locked = CrawlerJob::query()->whereKey($crawlerJob->id)->lockForUpdate()->firstOrFail();
            if (in_array($locked->status, [CrawlerJob::STATUS_COMPLETED, CrawlerJob::STATUS_FAILED], true)) {
                abort(422, 'Job is finished.');
            }

            if ($locked->story_id === null) {
                $newTitle = $locked->new_story_title;
                if ($newTitle === null || $newTitle === '') {
                    abort(422, 'Job has no story_id and new_story_title is empty.');
                }
                $story = Story::query()->create([
                    'title' => $newTitle,
                    'description' => null,
                    'genres' => [],
                    'serial_status' => 'ongoing',
                ]);
                $locked->forceFill(['story_id' => $story->id])->save();
            }

            $story = Story::query()->findOrFail($locked->story_id);
            $outcome = Chapter::createOrUpdateByTitleForStory($story, $title, $sanitizedContent);

            if ($outcome['created']) {
                $locked->forceFill([
                    'chapters_imported' => ((int) $locked->chapters_imported) + 1,
                ])->save();
            }
        });

        if ($outcome === null) {
            abort(500, 'Crawler chapter outcome missing.');
        }

        return $outcome;
    }
}
