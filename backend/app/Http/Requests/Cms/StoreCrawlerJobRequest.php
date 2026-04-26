<?php

namespace App\Http\Requests\Cms;

use Illuminate\Foundation\Http\FormRequest;

class StoreCrawlerJobRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('max_chapters') && $this->input('max_chapters') === '') {
            $this->merge(['max_chapters' => null]);
        }
        if ($this->has('story_id') && $this->input('story_id') === '') {
            $this->merge(['story_id' => null]);
        }
        if ($this->has('chapter_fetch_concurrency') && $this->input('chapter_fetch_concurrency') === '') {
            $this->merge(['chapter_fetch_concurrency' => null]);
        }
        if ($this->has('chapter_start') && $this->input('chapter_start') === '') {
            $this->merge(['chapter_start' => null]);
        }
    }

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
            'source_url' => ['required', 'string', 'url', 'max:2048'],
            'chapter_links_selector' => ['nullable', 'string', 'max:2000'],
            'chapter_list_next_page_selector' => ['nullable', 'string', 'max:2000'],
            'chapter_title_selector' => ['required', 'string', 'max:2000'],
            'chapter_content_selector' => ['required', 'string', 'max:2000'],
            'story_id' => ['nullable', 'integer', 'exists:stories,id'],
            'new_story_title' => ['nullable', 'string', 'max:255', 'required_without:story_id'],
            'max_chapters' => ['nullable', 'integer', 'min:0'],
            'chapter_start' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'delay_seconds' => ['nullable', 'numeric', 'min:0', 'max:120'],
            'chapter_fetch_concurrency' => ['nullable', 'integer', 'min:1', 'max:16'],
        ];
    }

    public function messages(): array
    {
        return [
            'new_story_title.required_without' => 'Nhập tiêu đề truyện mới hoặc chọn truyện có sẵn.',
        ];
    }
}
