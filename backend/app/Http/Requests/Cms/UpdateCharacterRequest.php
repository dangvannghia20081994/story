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
        ];
    }
}
