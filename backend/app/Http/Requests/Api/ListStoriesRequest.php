<?php

namespace App\Http\Requests\Api;

use App\Models\Story;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Query GET /api/stories — frontend ({@see \App\Http\Controllers\Api\Frontend\StoryController::index}).
 * CMS: GET /api/cms/stories — {@see \App\Http\Requests\Cms\ListCmsStoriesRequest}, {@see \App\Http\Controllers\Cms\StoryApiController}.
 */
class ListStoriesRequest extends FormRequest
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
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'exclude' => ['sometimes', 'integer', 'min:1'],
            'any_genre' => ['sometimes', 'string', 'max:500'],
            'genres' => ['sometimes', 'string', 'max:500'],
            'q' => ['sometimes', 'string', 'max:200'],
            'serial_status' => ['sometimes', 'string', Rule::in(Story::SERIAL_STATUSES)],
            'has_audio' => ['sometimes', 'string', Rule::in(['yes', 'no'])],
            'sort' => ['sometimes', 'string', Rule::in(['created_desc', 'created_asc', 'id_desc', 'id_asc'])],
        ];
    }
}
