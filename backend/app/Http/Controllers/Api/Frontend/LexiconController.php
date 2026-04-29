<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateLexiconRequest;
use App\Http\Requests\Api\ListLexiconsRequest;
use App\Http\Requests\Api\UpdateLexiconRequest;
use App\Models\Lexicon;
use App\Services\LexiconCacheService;
use Illuminate\Http\JsonResponse;

class LexiconController extends Controller
{
    public function __construct(
        private readonly LexiconCacheService $lexiconCache,
    ) {}

    public function index(ListLexiconsRequest $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 50)));

        return response()->json($this->lexiconCache->paginateGlobalFromCache($request, $perPage));
    }

    public function store(CreateLexiconRequest $request): JsonResponse
    {
        $entry = Lexicon::query()->create($request->validated());

        return response()->json($entry, 201);
    }

    public function show(int $lexicon): JsonResponse
    {
        $row = $this->lexiconCache->findById($lexicon) ?? Lexicon::query()->find($lexicon);
        if ($row === null) {
            abort(404);
        }

        return response()->json(['data' => $row]);
    }

    public function update(UpdateLexiconRequest $request, Lexicon $lexicon): JsonResponse
    {
        $lexicon->fill($request->validated())->save();

        return response()->json(['data' => $lexicon->fresh()]);
    }

    public function destroy(Lexicon $lexicon): JsonResponse
    {
        $lexicon->delete();

        return response()->json(null, 204);
    }
}
