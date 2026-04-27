<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoryController extends Controller
{
    public function index(): JsonResponse
    {
        $paginator = Story::query()
            ->with(['firstAudibleChapter' => fn ($q) => $q->select(['id', 'story_id', 'audio_path'])])
            ->withCount([
                'chapters',
                'chapters as chapters_with_audio_count' => fn ($q) => $q->whereNotNull('audio_path')->where('audio_path', '<>', ''),
            ])
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')],
            'description' => ['nullable', 'string', 'max:10000'],
            'genres' => ['nullable', 'array'],
            'genres.*' => ['string', Rule::in(Story::GENRES)],
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
            'serial_status' => ['nullable', 'string', Rule::in(Story::SERIAL_STATUSES)],
            'first_chapter' => ['nullable', 'array'],
            'first_chapter.title' => ['required_with:first_chapter', 'string', 'max:255'],
            'first_chapter.content' => ['required_with:first_chapter', 'string'],
        ]);

        if (isset($data['description']) && is_string($data['description']) && $data['description'] !== '') {
            $data['description'] = Story::stripExclusivePublishingNoticeLines($data['description']);
            if (trim($data['description']) === '') {
                $data['description'] = null;
            }
        }
        if (! empty($data['first_chapter']['content']) && is_string($data['first_chapter']['content'])) {
            $data['first_chapter']['content'] = Story::sanitizeChapterContent($data['first_chapter']['content']);
        }

        $story = DB::transaction(function () use ($data) {
            $slug = $data['slug'] ?? null;
            $genres = Story::sanitizeGenresList($data['genres'] ?? null, $data['genre'] ?? null);
            unset($data['genre'], $data['genres']);
            $story = Story::query()->create([
                'title' => $data['title'],
                'slug' => $slug,
                'description' => $data['description'] ?? null,
                'genres' => $genres,
                'serial_status' => $data['serial_status'] ?? 'ongoing',
            ]);

            if (! empty($data['first_chapter'])) {
                Chapter::createOrUpdateByTitleForStory(
                    $story,
                    $data['first_chapter']['title'],
                    $data['first_chapter']['content'],
                );
            }

            return $story->fresh();
        });

        return response()->json($story->loadCount('chapters'), 201);
    }

    public function show(Request $request, Story $story): JsonResponse
    {
        $data = $request->validate([
            'chapters_order' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
        ]);
        $chaptersOrder = ($data['chapters_order'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
        $fullChapters = $request->boolean('chapters_full');

        $chaptersTotal = $story->chapters()->count();
        $chaptersWithAudioTotal = $story->chapters()
            ->whereNotNull('audio_path')
            ->where('audio_path', '<>', '')
            ->count();

        $story->load(['chapters' => function ($q) use ($chaptersOrder, $fullChapters) {
            $q->reorder()->chuongSort($chaptersOrder);
            if (! $fullChapters) {
                $q->limit(10);
            }
        }]);
        $story->loadCount('characters');

        $chapters = $story->chapters->map(fn (Chapter $c) => array_merge($c->toArray(), [
            'audio_url' => $c->publicAudioUrl(),
        ]));

        return response()->json([
            'data' => array_merge($story->toArray(), [
                'chapters' => $chapters,
                'chapters_total' => $chaptersTotal,
                'chapters_with_audio_total' => $chaptersWithAudioTotal,
            ]),
        ]);
    }

    public function update(Request $request, Story $story): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('stories', 'slug')->ignore($story->id)],
            'description' => ['nullable', 'string', 'max:10000'],
            'genres' => ['nullable', 'array'],
            'genres.*' => ['string', Rule::in(Story::GENRES)],
            'genre' => ['nullable', 'string', Rule::in(Story::GENRES)],
            'serial_status' => ['nullable', 'string', Rule::in(Story::SERIAL_STATUSES)],
        ]);

        if (array_key_exists('slug', $data) && ($data['slug'] === null || $data['slug'] === '')) {
            $data['slug'] = Str::slug($story->title).'-'.$story->id;
        }

        if (array_key_exists('description', $data) && is_string($data['description']) && $data['description'] !== '') {
            $data['description'] = Story::stripExclusivePublishingNoticeLines($data['description']);
            if (trim($data['description']) === '') {
                $data['description'] = null;
            }
        }

        if (array_key_exists('genres', $data) || array_key_exists('genre', $data)) {
            $data['genres'] = Story::sanitizeGenresList($data['genres'] ?? null, $data['genre'] ?? null);
            unset($data['genre']);
        }

        $story->fill($data)->save();

        return response()->json(['data' => $story->fresh()->loadCount('chapters')]);
    }

    public function destroy(Story $story): JsonResponse
    {
        $story->delete();

        return response()->json(null, 204);
    }
}
