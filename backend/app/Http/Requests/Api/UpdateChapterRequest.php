<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateChapterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'chapter_number' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'content' => ['sometimes', 'string'],
            'duration' => ['sometimes', 'numeric', 'min:0'],
        ];
    }
}
