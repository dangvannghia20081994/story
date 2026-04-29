<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateLexiconRequest;
use App\Http\Requests\Api\ListLexiconsRequest;
use App\Http\Requests\Api\UpdateLexiconRequest;
use App\Models\Lexicon;
use Illuminate\Http\JsonResponse;

class LexiconController extends Controller
{
    public function index(ListLexiconsRequest $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 50)));

        $items = Lexicon::query()
            ->orderByDesc('priority')
            ->orderBy('word')
            ->paginate($perPage);

        return response()->json($items);
    }

    public function store(CreateLexiconRequest $request): JsonResponse
    {
        $entry = Lexicon::query()->create($request->validated());

        return response()->json($entry, 201);
    }

    public function show(Lexicon $lexicon): JsonResponse
    {
        return response()->json(['data' => $lexicon]);
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
