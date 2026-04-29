<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ShowStoryRequest extends FormRequest
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
            'chapters_order' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'chapters_full' => ['sometimes', 'boolean'],
            'chapters_limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'chapters_offset' => ['sometimes', 'integer', 'min:0'],
            'chapters_omit_content' => ['sometimes', 'boolean'],
            'read_chapter' => ['sometimes', 'integer', 'min:1'],
            'read_chapter_slug' => ['sometimes', 'string', 'max:191'],
        ];
    }
}
