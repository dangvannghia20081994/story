<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ListLexiconsRequest;
use App\Models\Story;
use App\Services\LexiconCacheService;
use Illuminate\Http\JsonResponse;

class StoryLexiconController extends Controller
{
    public function __construct(
        private readonly LexiconCacheService $lexiconCache,
    ) {}

    /** Lexicon chung + lexicon riêng truyện (đã gộp, cache). */
    public function index(ListLexiconsRequest $request, Story $story): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 50)));

        return response()->json($this->lexiconCache->paginateMergedForStory($request, (int) $story->id, $perPage));
    }
}
