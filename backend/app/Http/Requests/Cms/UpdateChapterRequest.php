<?php

namespace App\Http\Requests\Cms;

use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            $this->merge(['content' => Story::stripExclusivePublishingNoticeLines($content)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'string'],
            'status' => ['sometimes', 'string', Rule::in([
                Chapter::STATUS_PENDING,
                Chapter::STATUS_PROCESSING,
                Chapter::STATUS_COMPLETED,
                Chapter::STATUS_FAILED,
            ])],
            'duration' => ['sometimes', 'integer', 'min:0'],
            'error_message' => ['nullable', 'string', 'max:5000'],
            'audio_path' => ['nullable', 'string', 'max:1024'],
        ];
    }
}
