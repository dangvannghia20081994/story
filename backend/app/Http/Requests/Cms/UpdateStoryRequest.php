<?php

namespace App\Http\Requests\Cms;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $desc = $this->input('description');
        if (is_string($desc) && $desc !== '') {
            $clean = Story::stripExclusivePublishingNoticeLines($desc);
            $this->merge(['description' => trim($clean) === '' ? null : $clean]);
        }

        if ($this->boolean('_genres_form') && ! $this->has('genres')) {
            $this->merge(['genres' => []]);
        }
        if ($this->has('genres') || $this->has('genre')) {
            $g = $this->input('genre');
            $legacy = is_string($g) && $g !== '' ? $g : null;
            $this->merge([
                'genres' => Story::sanitizeGenresList(
                    is_array($this->input('genres')) ? $this->input('genres') : [],
                    $legacy,
                ),
            ]);
        }
        $this->request->remove('genre');
        $this->request->remove('_genres_form');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Story $story */
        $story = $this->route('story');

        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')->ignore($story->id)],
            'description' => ['nullable', 'string', 'max:10000'],
            'genres' => ['sometimes', 'array'],
            'genres.*' => ['string', Rule::in(Story::GENRES)],
            'serial_status' => ['nullable', 'string', Rule::in(Story::SERIAL_STATUSES)],
        ];
    }
}
