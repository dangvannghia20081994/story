<?php

namespace App\Http\Requests\Cms;

use App\Support\TtsConfig;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
        $voiceKeys = array_keys(TtsConfig::voices());

        return [
            'characters' => ['required', 'array', 'min:1', 'max:200'],
            'characters.*.name' => ['required', 'string', 'max:255'],
            'characters.*.voice_id' => ['required', 'string', Rule::in($voiceKeys)],
            'characters.*.pitch' => ['nullable', 'numeric', 'min:0.1', 'max:3'],
            'characters.*.rate' => ['nullable', 'numeric', 'min:0.1', 'max:3'],
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
        $voiceKeys = array_keys(TtsConfig::voices());
        $filtered = [];
        foreach ($characters as $row) {
            if (! is_array($row)) {
                continue;
            }
            if (! filled($row['name'] ?? null)) {
                continue;
            }
            $vid = $row['voice_id'] ?? null;
            if (! is_string($vid) || $vid === '' || ! in_array($vid, $voiceKeys, true)) {
                continue;
            }
            $pitch = $row['pitch'] ?? null;
            $rate = $row['rate'] ?? null;
            if ($pitch === '' || $pitch === null) {
                $pitch = 1.0;
            } else {
                $pitch = (float) $pitch;
            }
            if ($rate === '' || $rate === null) {
                $rate = 1.0;
            } else {
                $rate = (float) $rate;
            }
            $filtered[] = [
                'name' => $row['name'],
                'voice_id' => $vid,
                'pitch' => $pitch,
                'rate' => $rate,
            ];
        }
        $this->merge(['characters' => array_values($filtered)]);
    }

    public function messages(): array
    {
        return [
            'characters.required' => 'Chưa có dòng dữ liệu hợp lệ (cần tên + voice).',
            'characters.min' => 'Chưa có dòng dữ liệu hợp lệ (cần tên + voice).',
            'characters.max' => 'Tối đa 200 dòng mỗi lần.',
        ];
    }
}
