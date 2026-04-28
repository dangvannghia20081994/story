<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Story;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChapterController extends Controller
{
    public function index(Request $request, Story $story): JsonResponse
    {
        $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            /** Bỏ cột content — dùng mục lục / phân trang an toàn với truyện dài. */
            'omit_content' => ['sometimes', 'boolean'],
        ]);
        $perPage = min(100, max(1, (int) $request->input('per_page', 30)));
        $omitContent = (bool) $request->boolean('omit_content');

        $query = $story->chapters()->reorder()->chapterNumberSort('asc');
        if ($omitContent) {
            $query->select([
                'id', 'story_id', 'title', 'chapter_number', 'audio_path',
                'duration', 'tts_enqueued_at', 'created_at', 'updated_at',
            ]);
        }

        $paginator = $query->paginate($perPage);

        $paginator->getCollection()->transform(function (Chapter $chapter) {
            return array_merge($chapter->toArray(), [
                'audio_url' => $chapter->signedAudioStreamUrl(),
            ]);
        });

        return response()->json($paginator);
    }

    #[Response(201, description: 'Chương mới được tạo.', type: 'array<string, mixed>')]
    #[Response(200, description: 'Chương đã tồn tại theo tiêu đề — nội dung được cập nhật.', type: 'array<string, mixed>')]
    public function store(Request $request, Story $story): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'chapter_number' => ['nullable', 'integer', 'min:1', 'max:999999'],
        ]);

        $data['content'] = Story::sanitizeChapterContent($data['content']);

        $outcome = Chapter::createOrUpdateByTitleForStory(
            $story,
            $data['title'],
            $data['content'],
            $data['chapter_number'] ?? null,
        );
        $chapter = $outcome['chapter'];

        return response()->json(
            array_merge($chapter->toArray(), [
                'audio_url' => $chapter->signedAudioStreamUrl(),
                'chapter_created' => $outcome['created'],
            ]),
            $outcome['created'] ? 201 : 200
        );
    }

    public function show(Story $story, Chapter $chapter): JsonResponse
    {
        $this->assertBelongs($story, $chapter);

        return response()->json([
            'data' => array_merge($chapter->toArray(), [
                'audio_url' => $chapter->signedAudioStreamUrl(),
            ]),
        ]);
    }

    public function update(Request $request, Story $story, Chapter $chapter): JsonResponse
    {
        $this->assertBelongs($story, $chapter);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'chapter_number' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'content' => ['sometimes', 'string'],
            'duration' => ['sometimes', 'numeric', 'min:0'],
        ]);

        if (array_key_exists('content', $data) && is_string($data['content']) && $data['content'] !== '') {
            $data['content'] = Story::sanitizeChapterContent($data['content']);
        }

        $chapter->fill($data)->save();
        $fresh = $chapter->fresh();

        return response()->json([
            'data' => array_merge($fresh->toArray(), [
                'audio_url' => $fresh->signedAudioStreamUrl(),
            ]),
        ]);
    }

    public function destroy(Story $story, Chapter $chapter): JsonResponse
    {
        $this->assertBelongs($story, $chapter);
        $chapter->delete();

        return response()->json(null, 204);
    }

    private function assertBelongs(Story $story, Chapter $chapter): void
    {
        if ((int) $chapter->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}
