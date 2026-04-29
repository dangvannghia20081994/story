<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\ListCmsStoriesRequest;
use App\Services\StoryService;
use Illuminate\Http\JsonResponse;

/**
 * JSON GET /api/cms/stories — cùng khu CMS với {@see StoryController} (Blade /admin).
 */
class StoryApiController extends Controller
{
    public function __construct(
        private readonly StoryService $storyService,
    ) {}

    /**
     * Danh sách truyện cho CMS (JSON): ít query hơn GET /api/stories
     * ({@see \App\Http\Controllers\Api\Frontend\StoryController::index}).
     */
    public function index(ListCmsStoriesRequest $request): JsonResponse
    {
        return response()->json($this->storyService->paginateForCmsApi($request));
    }
}
