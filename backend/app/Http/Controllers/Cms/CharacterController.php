<?php

namespace App\Http\Controllers\Cms;

use App\Http\Controllers\Controller;
use App\Http\Requests\Cms\StoreBulkCharactersRequest;
use App\Http\Requests\Cms\StoreCharacterRequest;
use App\Http\Requests\Cms\UpdateCharacterRequest;
use App\Models\Character;
use App\Models\Story;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

    public function createBulk(Story $story): View
    {
        return view('cms.characters.bulk', compact('story'));
    }

    public function store(StoreCharacterRequest $request, Story $story): RedirectResponse
    {
        $data = $request->validated();

        $story->characters()->create([
            'name' => $data['name'],
        ]);

        return redirect()->route('cms.stories.characters.index', $story)->with('status', 'Đã tạo nhân vật.');
    }

    public function storeBulk(StoreBulkCharactersRequest $request, Story $story): RedirectResponse
    {
        $rows = $request->validated('characters');

        DB::transaction(function () use ($rows, $story): void {
            foreach ($rows as $row) {
                $story->characters()->create([
                    'name' => $row['name'],
                ]);
            }
        });

        $n = count($rows);

        return redirect()->route('cms.stories.characters.index', $story)->with('status', "Đã tạo {$n} nhân vật.");
    }

    public function edit(Story $story, Character $character): View
    {
        $this->assertBelongs($story, $character);

        return view('cms.characters.edit', compact('story', 'character'));
    }

    public function update(UpdateCharacterRequest $request, Story $story, Character $character): RedirectResponse
    {
        $this->assertBelongs($story, $character);

        $data = $request->validated();
        $deleteVoice = (bool) ($data['delete_voice_file'] ?? false);
        unset($data['voice_file'], $data['delete_voice_file']);

        $character->fill($data);

        if ($deleteVoice) {
            $this->deleteCharacterVoice($character);
        }
        if ($request->hasFile('voice_file')) {
            $this->storeCharacterVoice($character, $request->file('voice_file'));
        }

        $character->save();

        return redirect()->route('cms.stories.characters.index', $story)->with('status', 'Đã cập nhật nhân vật.');
    }

    public function destroy(Story $story, Character $character): RedirectResponse
    {
        $this->assertBelongs($story, $character);
        $this->deleteCharacterVoice($character);
        $character->delete();

        return redirect()->route('cms.stories.characters.index', $story)->with('status', 'Đã xóa nhân vật.');
    }

    private function deleteCharacterVoice(Character $character): void
    {
        $path = $character->voice_reference_path;
        if (is_string($path) && $path !== '') {
            Storage::disk('local')->delete($path);
        }
        $character->voice_reference_path = null;
    }

    private function storeCharacterVoice(Character $character, \Illuminate\Http\UploadedFile $file): void
    {
        if ($character->voice_reference_path) {
            Storage::disk('local')->delete($character->voice_reference_path);
        }
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'wav');
        $filename = $character->getKey().'.'.$ext;
        $relative = Character::VOICE_DIR.'/'.$filename;
        Storage::disk('local')->putFileAs(Character::VOICE_DIR, $file, $filename);
        $character->voice_reference_path = $relative;
    }

    private function assertBelongs(Story $story, Character $character): void
    {
        if ((int) $character->story_id !== (int) $story->id) {
            abort(404);
        }
    }
}
