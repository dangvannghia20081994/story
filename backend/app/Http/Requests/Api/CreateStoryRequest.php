<?php

namespace App\Http\Requests\Api;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateStoryRequest extends FormRequest
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
        return [
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')],
            'description' => ['nullable', 'string', 'max:10000'],
            'genres' => ['nullable', 'array'],
            'genres.*' => ['string', Rule::in(Story::GENRES)],
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
            'serial_status' => ['nullable', 'string', Rule::in(Story::SERIAL_STATUSES)],
            'first_chapter' => ['nullable', 'array'],
            'first_chapter.title' => ['required_with:first_chapter', 'string', 'max:255'],
            'first_chapter.content' => ['required_with:first_chapter', 'string'],
        ];
    }
}
