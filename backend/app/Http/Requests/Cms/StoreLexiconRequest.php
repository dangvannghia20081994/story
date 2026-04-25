<?php

namespace App\Http\Requests\Cms;

use App\Models\Lexicon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLexiconRequest extends FormRequest
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
        $type = $this->input('type', Lexicon::TYPE_PRONUNCIATION);

        return [
            'word' => [
                'required',
                'string',
                'max:255',
                Rule::unique('lexicons', 'word')->where('type', $type),
            ],
            'replacement' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in([
                Lexicon::TYPE_PRONUNCIATION,
                Lexicon::TYPE_NAME,
                Lexicon::TYPE_FILTER,
            ])],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:999999'],
        ];
    }
}
