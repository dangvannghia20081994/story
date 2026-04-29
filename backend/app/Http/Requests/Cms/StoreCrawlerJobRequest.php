<?php

namespace App\Http\Requests\Cms;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

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
     * @return list<string>
     */
    public static function validHttpSourceUrls(string $raw): array
    {
        $lines = preg_split('/\R/u', $raw) ?: [];
        $urls = [];
        foreach ($lines as $line) {
            $u = trim((string) $line);
            if ($u === '') {
                continue;
            }
            if (filter_var($u, FILTER_VALIDATE_URL) === false) {
                continue;
            }
            if (! str_starts_with($u, 'http://') && ! str_starts_with($u, 'https://')) {
                continue;
            }
            $urls[] = $u;
        }

        return $urls;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'source_url' => ['required', 'string', 'max:10000'],
            'chapter_links_selector' => ['nullable', 'string', 'max:2000'],
            'chapter_list_next_page_selector' => ['nullable', 'string', 'max:2000'],
            'chapter_title_selector' => ['required', 'string', 'max:2000'],
            'chapter_content_selector' => ['required', 'string', 'max:2000'],
            'story_id' => ['nullable', 'integer', 'exists:stories,id'],
            'new_story_title' => ['nullable', 'string', 'max:255'],
            'story_title_selector' => ['nullable', 'string', 'max:2000'],
            'max_chapters' => ['nullable', 'integer', 'min:0'],
            'chapter_start' => ['nullable', 'integer', 'min:1', 'max:999999'],
            'delay_seconds' => ['nullable', 'numeric', 'min:0', 'max:120'],
            'chapter_fetch_concurrency' => ['nullable', 'integer', 'min:1', 'max:16'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            $urls = self::validHttpSourceUrls((string) $this->input('source_url', ''));
            if ($urls === []) {
                $v->errors()->add('source_url', 'Cần ít nhất một dòng là URL http(s) hợp lệ.');

                return;
            }
            if (filled($this->input('story_id')) && count($urls) > 1) {
                $v->errors()->add('story_id', 'Gắn truyện có sẵn chỉ khi có đúng một URL (một dòng).');

                return;
            }
            if (! filled($this->input('story_id'))) {
                $manual = trim((string) $this->input('new_story_title', ''));
                $sel = trim((string) $this->input('story_title_selector', ''));
                if ($manual === '' && $sel === '') {
                    $v->errors()->add(
                        'story_title_selector',
                        'Truyện mới: nhập «Tiêu đề truyện mới» hoặc «Selector tên truyện» (lấy từ trang nguồn).',
                    );
                }
            }
        });
    }
}
