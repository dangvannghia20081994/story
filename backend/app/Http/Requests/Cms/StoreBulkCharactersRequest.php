<?php

namespace App\Http\Requests\Cms;

use Illuminate\Foundation\Http\FormRequest;

class StoreBulkCharactersRequest extends FormRequest
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
            'characters' => ['required', 'array', 'min:1', 'max:200'],
            'characters.*.name' => ['required', 'string', 'max:255'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $characters = $this->input('characters');
        if (is_string($characters)) {
            $decoded = json_decode($characters, true);
            $characters = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($characters)) {
            $characters = [];
        }
        $filtered = [];
        foreach ($characters as $row) {
            if (! is_array($row)) {
                continue;
            }
            $name = isset($row['name']) ? trim((string) $row['name']) : '';
            if ($name === '') {
                continue;
            }
            $filtered[] = ['name' => $name];
        }
        $this->merge(['characters' => array_values($filtered)]);
    }

    public function messages(): array
    {
        return [
            'characters.required' => 'Chưa có dòng dữ liệu hợp lệ (cần ít nhất một tên).',
            'characters.min' => 'Chưa có dòng dữ liệu hợp lệ (cần ít nhất một tên).',
            'characters.max' => 'Tối đa 200 dòng mỗi lần.',
        ];
    }
}
