<?php

namespace App\Http\Requests\Cms;

use Illuminate\Foundation\Http\FormRequest;

class StripChapterContentRequest extends FormRequest
{
    public const MAX_PHRASES = 150;

    public const MAX_PHRASE_LENGTH = 500;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $raw = $this->input('phrases_text');
        if (! is_string($raw)) {
            $this->merge(['phrases' => []]);

            return;
        }

        $lines = preg_split('/\R/u', $raw) ?: [];
        $phrases = [];
        foreach ($lines as $line) {
            if (! is_string($line)) {
                continue;
            }
            $t = trim($line);
            if ($t === '') {
                continue;
            }
            $phrases[] = $t;
        }

        $this->merge(['phrases' => array_values($phrases)]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phrases' => ['required', 'array', 'min:1', 'max:'.self::MAX_PHRASES],
            'phrases.*' => ['required', 'string', 'max:'.self::MAX_PHRASE_LENGTH],
        ];
    }

    public function messages(): array
    {
        return [
            'phrases.required' => 'Nhập ít nhất một dòng chuỗi cần gỡ (dòng trống sẽ bỏ qua).',
            'phrases.min' => 'Nhập ít nhất một dòng chuỗi cần gỡ (dòng trống sẽ bỏ qua).',
            'phrases.max' => 'Tối đa '.self::MAX_PHRASES.' chuỗi mỗi lần.',
            'phrases.*.max' => 'Mỗi chuỗi tối đa '.self::MAX_PHRASE_LENGTH.' ký tự.',
        ];
    }
}
