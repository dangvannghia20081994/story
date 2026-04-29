<?php

namespace App\Http\Controllers\Api\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CreateCharacterRequest;
use App\Http\Requests\Api\ListCharactersRequest;
use App\Http\Requests\Api\UpdateCharacterRequest;
use App\Models\Character;
use App\Models\Story;
use Illuminate\Http\JsonResponse;

class CharacterController extends Controller
{
    public function index(ListCharactersRequest $request, Story $story): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->input('per_page', 50)));

        $items = $story->characters()->orderBy('name')->paginate($perPage);

        return response()->json($items);
    }

    public function store(CreateCharacterRequest $request, Story $story): JsonResponse
    {
        $character = $story->characters()->create([
            'name' => $request->validated('name'),
        ]);

        return response()->json($character, 201);
    }

    public function show(Story $story, Character $character): JsonResponse
    {
        $this->assertBelongs($story, $character);

        return response()->json(['data' => $character]);
    }

    public function update(UpdateCharacterRequest $request, Story $story, Character $character): JsonResponse
    {
        $this->assertBelongs($story, $character);

        $character->fill($request->validated())->save();

        return response()->json(['data' => $character->fresh()]);
    }

    public function destroy(Story $story, Character $character): JsonResponse
    {
        $this->assertBelongs($story, $character);
        $character->delete();

        return response()->json(null, 204);
    }

    private function assertBelongs(Story $story, Character $character): void
    {
        if ((int) $character->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}
