<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChapterController extends Controller
{
    public function index(Story $story): JsonResponse
    {
        $paginator = $story->chapters()
            ->orderBy('id')
            ->paginate(30);

        $paginator->getCollection()->transform(function (Chapter $chapter) {
            return array_merge($chapter->toArray(), [
                'audio_url' => $chapter->publicAudioUrl(),
            ]);
        });

        return response()->json($paginator);
    }

    public function store(Request $request, Story $story): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
        ]);

        $data['content'] = Story::stripExclusivePublishingNoticeLines($data['content']);

        $chapter = $story->chapters()->create([
            'title' => $data['title'],
            'content' => $data['content'],
        ]);

        return response()->json($chapter, 201);
    }

    public function show(Story $story, Chapter $chapter): JsonResponse
    {
        $this->assertBelongs($story, $chapter);

        return response()->json([
            'data' => array_merge($chapter->toArray(), [
                'audio_url' => $chapter->publicAudioUrl(),
            ]),
        ]);
    }

    public function update(Request $request, Story $story, Chapter $chapter): JsonResponse
    {
        $this->assertBelongs($story, $chapter);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'string'],
            'duration' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('content', $data) && is_string($data['content']) && $data['content'] !== '') {
            $data['content'] = Story::stripExclusivePublishingNoticeLines($data['content']);
        }

        $chapter->fill($data)->save();
        $fresh = $chapter->fresh();

        return response()->json([
            'data' => array_merge($fresh->toArray(), [
                'audio_url' => $fresh->publicAudioUrl(),
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
