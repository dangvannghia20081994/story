<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateChapterRequest;
use App\Http\Requests\Api\ListChaptersRequest;
use App\Http\Requests\Api\UpdateChapterRequest;
use App\Models\Chapter;
use App\Models\Story;
use App\Services\ChapterService;
use Dedoc\Scramble\Attributes\Response;
use Illuminate\Http\JsonResponse;

class ChapterController extends Controller
{
    public function __construct(
        private readonly ChapterService $chapterService,
    ) {}

    public function index(ListChaptersRequest $request, Story $story): JsonResponse
    {
        return response()->json($this->chapterService->paginateForPublicApi($request, $story));
    }

    #[Response(201, description: 'Chương mới được tạo.', type: 'array<string, mixed>')]
    #[Response(200, description: 'Chương đã tồn tại theo tiêu đề — nội dung được cập nhật.', type: 'array<string, mixed>')]
    public function store(CreateChapterRequest $request, Story $story): JsonResponse
    {
        $outcome = $this->chapterService->createOrUpdateByTitle($story, $request->validated());
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
        $this->chapterService->assertBelongsToStory($story, $chapter);

        return response()->json([
            'data' => array_merge($chapter->toArray(), [
                'audio_url' => $chapter->signedAudioStreamUrl(),
            ]),
        ]);
    }

    public function update(UpdateChapterRequest $request, Story $story, Chapter $chapter): JsonResponse
    {
        $fresh = $this->chapterService->updateBelongingChapter($story, $chapter, $request->validated());

        return response()->json([
            'data' => array_merge($fresh->toArray(), [
                'audio_url' => $fresh->signedAudioStreamUrl(),
            ]),
        ]);
    }

    public function destroy(Story $story, Chapter $chapter): JsonResponse
    {
        $this->chapterService->deleteBelongingChapter($story, $chapter);

        return response()->json(null, 204);
    }
}
