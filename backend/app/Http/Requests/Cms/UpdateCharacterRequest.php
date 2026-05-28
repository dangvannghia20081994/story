<?php

namespace App\Http\Requests\Cms;

use App\Models\Character;
use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCharacterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Story $story */
        $story = $this->route('story');
        /** @var Character $character */
        $character = $this->route('character');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('characters', 'name')
                    ->where('story_id', $story->id)
                    ->ignore($character->id),
            ],
            'voice_preset' => ['nullable', 'string', 'max:50'],
            'pitch_semitones' => ['nullable', 'integer', 'between:-12,12'],
            'tempo_factor' => ['nullable', 'numeric', 'between:0.5,2.0'],
            'voice_file' => ['nullable', 'file', 'mimetypes:audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a', 'max:5120'],
            'delete_voice_file' => ['nullable', 'boolean'],
        ];
    }
}
