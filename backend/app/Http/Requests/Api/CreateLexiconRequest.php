<?php

namespace App\Http\Requests\Api;

use App\Enums\LexiconType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateLexiconRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('type')) {
            $this->merge(['type' => LexiconType::Pronunciation->value]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'word' => [
                'required',
                'string',
                'max:255',
                Rule::unique('lexicons', 'word')->where('type', $this->input('type')),
            ],
            'replacement' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(LexiconType::values())],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:999999'],
        ];
    }
}
