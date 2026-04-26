<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Character;
use App\Models\Story;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CharacterController extends Controller
{
    public function index(Story $story): JsonResponse
    {
        $items = $story->characters()->orderBy('name')->paginate(50);

        return response()->json($items);
    }

    public function store(Request $request, Story $story): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $character = $story->characters()->create([
            'name' => $data['name'],
        ]);

        return response()->json($character, 201);
    }

    public function show(Story $story, Character $character): JsonResponse
    {
        $this->assertBelongs($story, $character);

        return response()->json(['data' => $character]);
    }

    public function update(Request $request, Story $story, Character $character): JsonResponse
    {
        $this->assertBelongs($story, $character);

        $data = $request->validate([
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('characters', 'name')
                    ->where('story_id', $story->id)
                    ->ignore($character->id),
            ],
        ]);

        $character->fill($data)->save();

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
