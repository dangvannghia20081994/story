<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;

class UpdateChapterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $content = $this->input('content');
        if (is_string($content) && $content !== '') {
            $this->merge(['content' => Story::sanitizeChapterContent($content)]);
        }
        if ($this->has('chapter_number') && $this->input('chapter_number') === '') {
            $this->merge(['chapter_number' => null]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'chapter_number' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'content' => ['sometimes', 'string'],
            'duration' => ['sometimes', 'numeric', 'min:0'],
            'audio_multiple_path' => ['nullable', 'string', 'max:1024'],
        ];
    }
}
