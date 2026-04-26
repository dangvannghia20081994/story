<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBulkStoriesRequest extends FormRequest
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
            'stories' => ['required', 'array', 'min:1', 'max:200'],
            'stories.*.title' => ['required', 'string', 'max:255'],
            'stories.*.slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')],
            'stories.*.description' => ['nullable', 'string', 'max:10000'],
            'stories.*.genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
            'stories.*.serial_status' => ['nullable', 'string', Rule::in(Story::SERIAL_STATUSES)],
        ];
    }

    protected function prepareForValidation(): void
    {
        $stories = $this->input('stories');
        if (is_string($stories)) {
            $decoded = json_decode($stories, true);
            $stories = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($stories)) {
            $stories = [];
        }
        $filtered = [];
        foreach ($stories as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (! filled($row['title'] ?? null)) {
                continue;
            }
            $g = $row['genre'] ?? null;
            if (is_string($g) && $g === '') {
                $g = null;
            }
            $s = $row['slug'] ?? null;
            if (is_string($s) && $s === '') {
                $s = null;
            }
            $d = $row['description'] ?? null;
            if (is_string($d) && $d !== '') {
                $d = Story::stripExclusivePublishingNoticeLines($d);
            }
            if (is_string($d) && trim($d) === '') {
                $d = null;
            }
            $st = $row['serial_status'] ?? null;
            if (is_string($st) && $st === '') {
                $st = null;
            }
            $filtered[] = array_merge($row, [
                'title' => $row['title'],
                'slug' => $s,
                'description' => $d,
                'genre' => $g,
                'serial_status' => $st,
            ]);
        }
        $this->merge(['stories' => array_values($filtered)]);
    }

    public function messages(): array
    {
        return [
            'stories.required' => 'Chưa có dòng dữ liệu hợp lệ (cần ít nhất một cột tiêu đề).',
            'stories.min' => 'Chưa có dòng dữ liệu hợp lệ (cần ít nhất một cột tiêu đề).',
            'stories.max' => 'Tối đa 200 dòng mỗi lần.',
        ];
    }
}
