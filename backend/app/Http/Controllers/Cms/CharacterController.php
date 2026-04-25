<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreCharacterRequest;
use App\Http\Requests\Cms\UpdateCharacterRequest;
use App\Models\Character;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class CharacterController extends Controller
{
    public function index(Story $story): View
    {
        $characters = $story->characters()->orderBy('name')->paginate(50)->withQueryString();

        return view('cms.characters.index', compact('story', 'characters'));
    }

    public function create(Story $story): View
    {
        return view('cms.characters.create', compact('story'));
    }

    public function store(StoreCharacterRequest $request, Story $story): RedirectResponse
    {
        $data = $request->validated();

        $story->characters()->create([
            'name' => $data['name'],
            'voice_id' => $data['voice_id'],
            'pitch' => $data['pitch'] ?? 1.0,
            'rate' => $data['rate'] ?? 1.0,
        ]);

        return redirect()->route('cms.stories.characters.index', $story)->with('status', 'Đã tạo nhân vật.');
    }

    public function edit(Story $story, Character $character): View
    {
        $this->assertBelongs($story, $character);

        return view('cms.characters.edit', compact('story', 'character'));
    }

    public function update(UpdateCharacterRequest $request, Story $story, Character $character): RedirectResponse
    {
        $this->assertBelongs($story, $character);

        $character->fill($request->validated())->save();

        return redirect()->route('cms.stories.characters.index', $story)->with('status', 'Đã cập nhật nhân vật.');
    }

    public function destroy(Story $story, Character $character): RedirectResponse
    {
        $this->assertBelongs($story, $character);
        $character->delete();

        return redirect()->route('cms.stories.characters.index', $story)->with('status', 'Đã xóa nhân vật.');
    }

    private function assertBelongs(Story $story, Character $character): void
    {
        if ((int) $character->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}
