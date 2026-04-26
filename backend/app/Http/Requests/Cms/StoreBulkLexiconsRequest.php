<?php

namespace App\Http\Requests\Cms;

use App\Enums\LexiconType;
use App\Models\Lexicon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBulkLexiconsRequest extends FormRequest
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
            'lexicons' => ['required', 'array', 'min:1', 'max:200'],
            'lexicons.*.word' => ['required', 'string', 'max:255'],
            'lexicons.*.replacement' => ['required', 'string', 'max:255'],
            'lexicons.*.type' => ['required', 'string', Rule::in(LexiconType::values())],
            'lexicons.*.priority' => ['nullable', 'integer', 'min:0', 'max:999999'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $lexicons = $this->input('lexicons');
        if (is_string($lexicons)) {
            $decoded = json_decode($lexicons, true);
            $lexicons = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($lexicons)) {
            $lexicons = [];
        }
        $types = LexiconType::values();
        $filtered = [];
        foreach ($lexicons as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (! filled($row['word'] ?? null) || ! filled($row['replacement'] ?? null)) {
                continue;
            }
            $type = is_string($row['type'] ?? null) ? trim($row['type']) : '';
            if (! in_array($type, $types, true)) {
                continue;
            }
            $p = $row['priority'] ?? 0;
            if ($p === '' || $p === null) {
                $p = 0;
            }
            $filtered[] = [
                'word' => $row['word'],
                'replacement' => $row['replacement'],
                'type' => $type,
                'priority' => (int) $p,
            ];
        }
        $this->merge(['lexicons' => array_values($filtered)]);
    }

    public function withValidator($validator): void
    {
        $types = LexiconType::values();

        $validator->after(function ($validator) use ($types): void {
            $rows = $this->input('lexicons', []);
            if (! is_array($rows)) {
                return;
            }
            $seen = [];
            foreach ($rows as $i => $row) {
                if (! is_array($row)) {
                    continue;
                }
                $w = (string) ($row['word'] ?? '');
                $t = (string) ($row['type'] ?? '');
                if ($w === '' || ! in_array($t, $types, true)) {
                    continue;
                }
                $k = $w."\0".$t;
                if (isset($seen[$k])) {
                    $validator->errors()->add(
                        "lexicons.$i.word",
                        'Trùng từ + loại với dòng khác trong cùng lô.',
                    );
                    continue;
                }
                $seen[$k] = true;
                if (Lexicon::query()->where('word', $w)->where('type', $t)->exists()) {
                    $validator->errors()->add(
                        "lexicons.$i.word",
                        'Đã tồn tại lexicon cùng từ + loại.',
                    );
                }
            }
        });
    }

    public function messages(): array
    {
        return [
            'lexicons.required' => 'Chưa có dòng hợp lệ (cần từ, thay thế, loại).',
            'lexicons.min' => 'Chưa có dòng hợp lệ (cần từ, thay thế, loại).',
            'lexicons.max' => 'Tối đa 200 dòng mỗi lần.',
        ];
    }
}
