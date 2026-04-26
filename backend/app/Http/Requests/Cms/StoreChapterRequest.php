<?php

namespace App\Http\Requests\Cms;

use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreChapterRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'status' => ['sometimes', 'string', Rule::in([
                Chapter::STATUS_PENDING,
                Chapter::STATUS_PROCESSING,
                Chapter::STATUS_COMPLETED,
                Chapter::STATUS_FAILED,
            ])],
        ];
    }
}
