<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;

class StoreBulkChaptersRequest extends FormRequest
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
            'chapters' => ['required', 'array', 'min:1', 'max:200'],
            'chapters.*.title' => ['required', 'string', 'max:255'],
            'chapters.*.content' => ['required', 'string'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $chapters = $this->input('chapters');
        if (is_string($chapters)) {
            $decoded = json_decode($chapters, true);
            $chapters = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($chapters)) {
            $chapters = [];
        }
        $filtered = [];
        foreach ($chapters as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (! filled($row['title'] ?? null) || ! filled($row['content'] ?? null)) {
                continue;
            }
            $filtered[] = [
                'title' => $row['title'],
                'content' => Story::stripExclusivePublishingNoticeLines((string) $row['content']),
            ];
        }
        $this->merge(['chapters' => array_values($filtered)]);
    }

    public function messages(): array
    {
        return [
            'chapters.required' => 'Chưa có dòng dữ liệu hợp lệ (cần cả tiêu đề và nội dung).',
            'chapters.min' => 'Chưa có dòng dữ liệu hợp lệ (cần cả tiêu đề và nội dung).',
            'chapters.max' => 'Tối đa 200 dòng mỗi lần.',
        ];
    }
}
