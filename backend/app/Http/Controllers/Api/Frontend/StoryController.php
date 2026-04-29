<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateStoryRequest;
use App\Http\Requests\Api\ListStoriesRequest;
use App\Http\Requests\Api\ShowStoryRequest;
use App\Http\Requests\Api\UpdateStoryRequest;
use App\Models\Story;
use App\Services\StoryService;
use Illuminate\Http\JsonResponse;

class StoryController extends Controller
{
    public function __construct(
        private readonly StoryService $storyService,
    ) {}

    /** Danh sách khám phá / frontend — {@see ListStoriesRequest}. CMS JSON: {@see \App\Http\Controllers\Cms\StoryApiController::index}. */
    public function index(ListStoriesRequest $request): JsonResponse
    {
        return response()->json($this->storyService->paginateForPublicApi($request));
    }

    public function store(CreateStoryRequest $request): JsonResponse
    {
        $story = $this->storyService->createWithOptionalFirstChapter($request->validated());

        return response()->json($story->loadCount('chapters'), 201);
    }

    public function show(ShowStoryRequest $request, Story $story): JsonResponse
    {
        return response()->json($this->storyService->buildShowResponse($request, $story));
    }

    public function update(UpdateStoryRequest $request, Story $story): JsonResponse
    {
        $fresh = $this->storyService->updateFromValidated($story, $request->validated());

        return response()->json(['data' => $fresh]);
    }

    public function destroy(Story $story): JsonResponse
    {
        $story->delete();

        return response()->json(null, 204);
    }
}
