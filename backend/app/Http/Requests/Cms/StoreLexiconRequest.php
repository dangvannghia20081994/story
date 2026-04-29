<?php

namespace App\Http\Requests\Cms;

use App\Enums\LexiconType;
use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLexiconRequest extends FormRequest
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
        $type = $this->input('type', LexiconType::Pronunciation->value);

        return [
            'story_id' => ['nullable', 'integer', 'exists:stories,id'],
            'word' => [
                'required',
                'string',
                'max:255',
                Rule::unique('lexicons', 'word')
                    ->where('type', $type)
                    ->where(function (Builder $q): void {
                        if ($this->filled('story_id')) {
                            $q->where('story_id', (int) $this->input('story_id'));
                        } else {
                            $q->whereNull('story_id');
                        }
                    }),
            ],
            'replacement' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in(LexiconType::values())],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:999999'],
        ];
    }
}
