<?php

namespace App\Http\Requests\Cms;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class ReplaceChapterContentRequest extends FormRequest
{
    public const MAX_PAIRS = 150;

    public const MAX_SEARCH_LENGTH = 500;

    public const MAX_REPLACE_LENGTH = 5000;

    /** @var list<array{search: string, replacement: string}> */
    private array $parsedPairs = [];

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
            'rules_text' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'rules_text.required' => 'Nhập ít nhất một dòng quy tắc thay thế.',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $raw = $this->input('rules_text');
            if (! is_string($raw)) {
                $v->errors()->add('rules_text', 'Nội dung quy tắc không hợp lệ.');

                return;
            }

            $result = $this->parseRulesText($raw);
            if (is_string($result)) {
                $v->errors()->add('rules_text', $result);

                return;
            }

            if (count($result) === 0) {
                $v->errors()->add('rules_text', 'Nhập ít nhất một dòng quy tắc (dòng trống bỏ qua). Mỗi dòng: chuỗi tìm|||chuỗi thay.');

                return;
            }

            if (count($result) > self::MAX_PAIRS) {
                $v->errors()->add('rules_text', 'Tối đa '.self::MAX_PAIRS.' quy tắc mỗi lần.');

                return;
            }

            foreach ($result as $i => $row) {
                $line = $i + 1;
                if (strlen($row['search']) > self::MAX_SEARCH_LENGTH) {
                    $v->errors()->add('rules_text', "Dòng {$line}: chuỗi tìm tối đa ".self::MAX_SEARCH_LENGTH.' ký tự.');

                    return;
                }
                if (strlen($row['replacement']) > self::MAX_REPLACE_LENGTH) {
                    $v->errors()->add('rules_text', "Dòng {$line}: chuỗi thay tối đa ".self::MAX_REPLACE_LENGTH.' ký tự.');

                    return;
                }
            }

            $this->parsedPairs = $result;
        });
    }

    /**
     * @return list<array{search: string, replacement: string}>|string error message
     */
    private function parseRulesText(string $raw): array|string
    {
        $lines = preg_split('/\R/u', $raw) ?: [];
        $pairs = [];
        $lineNum = 0;

        foreach ($lines as $line) {
            $lineNum++;
            if (! is_string($line)) {
                continue;
            }
            $t = trim($line);
            if ($t === '') {
                continue;
            }
            if (! str_contains($t, '|||')) {
                return "Dòng {$lineNum}: thiếu dấu phân cách «|||» giữa chuỗi tìm và chuỗi thay.";
            }
            [$searchRaw, $replacement] = explode('|||', $t, 2);
            $search = trim($searchRaw);
            if ($search === '') {
                return "Dòng {$lineNum}: chuỗi tìm không được để trống.";
            }
            $pairs[] = ['search' => $search, 'replacement' => $replacement];
        }

        return $pairs;
    }

    /**
     * @return list<array{search: string, replacement: string}>
     */
    public function replacePairs(): array
    {
        return $this->parsedPairs;
    }
}
