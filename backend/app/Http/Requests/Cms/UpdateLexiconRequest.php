<?php

namespace App\Http\Requests\Cms;

use App\Models\Lexicon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLexiconRequest extends FormRequest
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
        /** @var Lexicon $lexicon */
        $lexicon = $this->route('lexicon');
        $type = $this->input('type', $lexicon->type);

        return [
            'word' => [
                'required',
                'string',
                'max:255',
                Rule::unique('lexicons', 'word')
                    ->where('type', $type)
                    ->ignore($lexicon->id),
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
