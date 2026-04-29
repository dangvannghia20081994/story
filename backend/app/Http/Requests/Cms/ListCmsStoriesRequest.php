<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Query danh sách truyện CMS (GET /api/cms/stories) — cùng bộ lọc cơ bản với màn Blade /admin/stories.
 */
class ListCmsStoriesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('genre') && trim((string) $this->input('genre')) === '') {
            $this->merge(['genre' => null]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'q' => ['sometimes', 'string', 'max:200'],
            'genre' => ['nullable', 'string', 'max:64', Rule::in(Story::GENRES)],
        ];
    }
}
