<?php

namespace App\Services;

use App\Http\Requests\Api\ListChaptersRequest;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Pagination\LengthAwarePaginator;

final class ChapterService
{
    public function paginateForPublicApi(ListChaptersRequest $request, Story $story): LengthAwarePaginator
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 30)));
        $omitContent = (bool) $request->boolean('omit_content');

        $query = $story->chapters()->reorder()->chapterNumberSort('asc');
        if ($omitContent) {
            $query->select([
                'id', 'story_id', 'title', 'slug', 'chapter_number', 'audio_path',
                'duration', 'tts_enqueued_at', 'created_at', 'updated_at',
            ]);
        }

        $paginator = $query->paginate($perPage);

        $paginator->getCollection()->transform(function (Chapter $chapter) {
            return array_merge($chapter->toArray(), [
                'audio_url' => $chapter->signedAudioStreamUrl(),
            ]);
        });

        return $paginator;
    }

    /**
     * @param  array{title: string, content: string, chapter_number?: int|null}  $data
     * @return array{chapter: Chapter, created: bool}
     */
    public function createOrUpdateByTitle(Story $story, array $data): array
    {
        $content = Story::sanitizeChapterContent($data['content']);

        return Chapter::createOrUpdateByTitleForStory(
            $story,
            $data['title'],
            $content,
            $data['chapter_number'] ?? null,
        );
    }

    /**
     * @param  array<string, mixed>  $data  Đã validate (API patch)
     */
    public function updateBelongingChapter(Story $story, Chapter $chapter, array $data): Chapter
    {
        $this->assertBelongsToStory($story, $chapter);

        if (array_key_exists('content', $data) && is_string($data['content']) && $data['content'] !== '') {
            $data['content'] = Story::sanitizeChapterContent($data['content']);
        }

        $chapter->fill($data)->save();

        return $chapter->fresh();
    }

    public function assertBelongsToStory(Story $story, Chapter $chapter): void
    {
        if ((int) $chapter->story_id !== (int) $story->id) {
            abort(404);
        }
    }

    public function deleteBelongingChapter(Story $story, Chapter $chapter): void
    {
        $this->assertBelongsToStory($story, $chapter);
        $chapter->delete();
    }
}
