<?php

namespace App\Http\Controllers\Api;

use App\Enums\LexiconType;
use App\Http\Controllers\Controller;
use App\Models\Lexicon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LexiconController extends Controller
{
    public function index(): JsonResponse
    {
        $items = Lexicon::query()
            ->orderByDesc('priority')
            ->orderBy('word')
            ->paginate(50);

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $entry = Lexicon::query()->create($data);

        return response()->json($entry, 201);
    }

    public function show(Lexicon $lexicon): JsonResponse
    {
        return response()->json(['data' => $lexicon]);
    }

    public function update(Request $request, Lexicon $lexicon): JsonResponse
    {
        $data = $this->validated($request, $lexicon);
        $lexicon->fill($data)->save();

        return response()->json(['data' => $lexicon->fresh()]);
    }

    public function destroy(Lexicon $lexicon): JsonResponse
    {
        $lexicon->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Lexicon $existing = null): array
    {
        $type = $request->input('type', $existing?->type ?? LexiconType::Pronunciation->value);

        $uniqueWord = Rule::unique('lexicons', 'word')
            ->where('type', $type);

        if ($existing !== null) {
            $uniqueWord = $uniqueWord->ignore($existing->id);
        }

        return $request->validate([
            'word' => ['required', 'string', 'max:255', $uniqueWord],
            'replacement' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(LexiconType::values())],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:999999'],
        ]);
    }
}
