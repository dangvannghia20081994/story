<?php

namespace App\Http\Requests\Cms;

use App\Enums\LexiconType;
use App\Models\Lexicon;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLexiconRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $sid = $this->input('story_id');
        if ($sid === '' || $sid === null) {
            $this->merge(['story_id' => null]);
        } elseif (is_numeric($sid)) {
            $this->merge(['story_id' => (int) $sid]);
        }
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
            'story_id' => ['nullable', 'integer', 'exists:stories,id'],
            'word' => [
                'required',
                'string',
                'max:255',
                Rule::unique('lexicons', 'word')
                    ->where('type', $type)
                    ->where(function (Builder $q) use ($lexicon): void {
                        $sid = $this->input('story_id', $lexicon->story_id);
                        if ($sid !== null && $sid !== '') {
                            $q->where('story_id', (int) $sid);
                        } else {
                            $q->whereNull('story_id');
                        }
                    })
                    ->ignore($lexicon->id),
            ],
            'replacement' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(LexiconType::values())],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:999999'],
        ];
    }
}
