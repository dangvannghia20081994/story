<?php

namespace App\Http\Requests\Cms;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCharacterRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'voice_id' => ['required', 'string', Rule::in(array_keys(config('tts.voices', [])))],
            'pitch' => ['sometimes', 'numeric', 'min:0.1', 'max:3'],
            'rate' => ['sometimes', 'numeric', 'min:0.1', 'max:3'],
        ];
    }
}
