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
    protected function prepareForValidation(): void
    {
        $desc = $this->input('description');
        if (is_string($desc) && $desc !== '') {
            $clean = Story::stripExclusivePublishingNoticeLines($desc);
            $this->merge(['description' => trim($clean) === '' ? null : $clean]);
        }
        $content = $this->input('first_chapter_content');
        if (is_string($content) && $content !== '') {
            $this->merge(['first_chapter_content' => Story::sanitizeChapterContent($content)]);
        }

        if ($this->boolean('_genres_form') && ! $this->has('genres')) {
            $this->merge(['genres' => []]);
        }
        if ($this->has('genres') || $this->has('genre')) {
            $g = $this->input('genre');
            $legacy = is_string($g) && $g !== '' ? $g : null;
            $this->merge([
                'genres' => Story::sanitizeGenresList(
                    is_array($this->input('genres')) ? $this->input('genres') : [],
                    $legacy,
                ),
            ]);
        }
        $this->request->remove('genre');
        $this->request->remove('_genres_form');
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')],
            'description' => ['nullable', 'string', 'max:10000'],
            'genres' => ['sometimes', 'array'],
            'genres.*' => ['string', Rule::in(Story::GENRES)],
            'serial_status' => ['nullable', 'string', Rule::in(Story::SERIAL_STATUSES)],
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
