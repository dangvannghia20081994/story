<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStoryRequest extends FormRequest
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
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
            'first_chapter_title' => ['nullable', 'string', 'max:255'],
            'first_chapter_content' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $title = $this->input('first_chapter_title');
            $content = $this->input('first_chapter_content');
            $hasTitle = filled($title);
            $hasContent = filled($content);
            if ($hasTitle xor $hasContent) {
                $validator->errors()->add(
                    'first_chapter_title',
                    'Chương đầu cần cả tiêu đề và nội dung, hoặc để trống cả hai.',
                );
            }
        });
    }
}
