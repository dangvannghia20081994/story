<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoryRequest extends FormRequest
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

        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')->ignore($story->id)],
            'description' => ['nullable', 'string', 'max:10000'],
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
        ];
    }
}
