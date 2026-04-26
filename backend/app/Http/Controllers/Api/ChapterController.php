<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Story;
use App\Services\TextPreprocessService;
use App\Services\VoiceSegmentBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\Validation\Rule;

class ChapterController extends Controller
{
    public function __construct(
        private TextPreprocessService $textPreprocess,
        private VoiceSegmentBuilder $voiceSegments,
    ) {}

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
            'status' => ['sometimes', 'string', Rule::in([
                Chapter::STATUS_PENDING,
                Chapter::STATUS_PROCESSING,
                Chapter::STATUS_COMPLETED,
                Chapter::STATUS_FAILED,
            ])],
        ]);

        $data['content'] = Story::stripExclusivePublishingNoticeLines($data['content']);

        $chapter = $story->chapters()->create([
            'title' => $data['title'],
            'content' => $data['content'],
            'status' => $data['status'] ?? Chapter::STATUS_PENDING,
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
            'status' => ['sometimes', 'string', Rule::in([
                Chapter::STATUS_PENDING,
                Chapter::STATUS_PROCESSING,
                Chapter::STATUS_COMPLETED,
                Chapter::STATUS_FAILED,
            ])],
            'duration' => ['sometimes', 'integer', 'min:0'],
            'error_message' => ['nullable', 'string', 'max:5000'],
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

    public function queueTts(Request $request, Story $story, Chapter $chapter): JsonResponse
    {
        $this->assertBelongs($story, $chapter);

        $request->validate([
            'regenerate' => ['sometimes', 'boolean'],
        ]);

        if ($chapter->status === Chapter::STATUS_PROCESSING) {
            return response()->json([
                'message' => 'Chương đang được xử lý TTS.',
            ], 409);
        }

        $raw = $chapter->content;
        $processed = $this->textPreprocess->apply($raw);
        $segments = $this->voiceSegments->build($story, $processed);

        $payload = json_encode([
            'chapter_id' => $chapter->id,
            'story_id' => $story->id,
            'text' => $processed,
            'voice_segments' => $segments,
        ], JSON_THROW_ON_ERROR);

        Redis::connection()->lpush('story:tts:queue', [$payload]);

        $chapter->forceFill([
            'status' => Chapter::STATUS_PROCESSING,
            'error_message' => null,
        ])->save();

        return response()->json([
            'message' => 'Đã xếp hàng TTS.',
            'data' => array_merge($chapter->fresh()->toArray(), [
                'audio_url' => $chapter->publicAudioUrl(),
            ]),
        ], 202);
    }

    private function assertBelongs(Story $story, Chapter $chapter): void
    {
        if ((int) $chapter->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}
