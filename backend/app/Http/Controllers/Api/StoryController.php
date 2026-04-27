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
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) $request->input('per_page', 20);
        $perPage = min(100, max(1, $perPage));

        $paginator = Story::query()
            ->with(['firstAudibleChapter' => fn ($q) => $q->select(['id', 'story_id', 'audio_path'])])
            ->withCount([
                'chapters',
                'chapters as chapters_with_audio_count' => fn ($q) => $q->whereNotNull('audio_path')->where('audio_path', '<>', ''),
            ])
            ->orderByDesc('id')
            ->paginate($perPage);

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
            'chapters_full' => ['sometimes', 'boolean'],
            'chapters_limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'chapters_offset' => ['sometimes', 'integer', 'min:0'],
            /** Không select cột content (danh sách chương / mục lục). */
            'chapters_omit_content' => ['sometimes', 'boolean'],
            /** Chỉ tải một chương đầy đủ + meta lân cận (tránh chapters_full với hàng nghìn chương). */
            'read_chapter' => ['sometimes', 'integer', 'min:1'],
        ]);

        $chaptersWithAudioTotal = $story->chapters()
            ->whereNotNull('audio_path')
            ->where('audio_path', '<>', '')
            ->count();

        $readChapterId = isset($data['read_chapter']) ? (int) $data['read_chapter'] : null;
        if ($readChapterId !== null) {
            $nav = Chapter::readNavigationFor($story, $readChapterId);
            if ($nav === null) {
                abort(404);
            }
            $story->unsetRelation('chapters');
            $story->loadCount('characters');
            $c = $nav['chapter'];

            $enrichNeighbor = function (?array $meta): ?array {
                if ($meta === null) {
                    return null;
                }
                $row = Chapter::query()->where('id', $meta['id'])->first(['id', 'title', 'audio_path', 'duration']);
                if ($row === null) {
                    return null;
                }

                return [
                    'id' => $row->id,
                    'title' => $row->title,
                    'duration' => (int) $row->duration,
                    'audio_url' => $row->publicAudioUrl(),
                ];
            };

            return response()->json([
                'data' => array_merge($story->toArray(), [
                    'chapters' => [],
                    'chapters_total' => $nav['chapters_total'],
                    'chapters_with_audio_total' => $chaptersWithAudioTotal,
                    'read_chapter' => array_merge($c->toArray(), [
                        'audio_url' => $c->publicAudioUrl(),
                    ]),
                    'read_navigation' => [
                        'chapter_index' => $nav['chapter_index'],
                        'chapters_total' => $nav['chapters_total'],
                        'prev' => $enrichNeighbor($nav['prev']),
                        'next' => $enrichNeighbor($nav['next']),
                    ],
                ]),
            ]);
        }

        $chaptersOrder = ($data['chapters_order'] ?? 'asc') === 'desc' ? 'desc' : 'asc';
        $fullChapters = (bool) ($data['chapters_full'] ?? false);
        $chaptersLimit = $fullChapters ? null : min(100, max(1, (int) ($data['chapters_limit'] ?? 10)));
        $chaptersOffset = $fullChapters ? null : max(0, (int) ($data['chapters_offset'] ?? 0));
        $chaptersOmitContent = ! $fullChapters && (bool) ($data['chapters_omit_content'] ?? false);

        $chaptersTotal = $story->chapters()->count();

        $story->load(['chapters' => function ($q) use ($chaptersOrder, $fullChapters, $chaptersLimit, $chaptersOffset, $chaptersOmitContent) {
            $q->reorder()->chapterNumberSort($chaptersOrder);
            if ($chaptersOmitContent) {
                $q->select([
                    'id', 'story_id', 'title', 'chapter_number', 'audio_path',
                    'duration', 'tts_enqueued_at', 'created_at', 'updated_at',
                ]);
            }
            if (! $fullChapters && $chaptersLimit !== null) {
                $q->offset($chaptersOffset ?? 0)->limit($chaptersLimit);
            }
        }]);
        $story->loadCount('characters');

        $chapters = $story->chapters->map(function (Chapter $c) use ($chaptersOmitContent) {
            $arr = array_merge($c->toArray(), [
                'audio_url' => $c->publicAudioUrl(),
            ]);
            if ($chaptersOmitContent) {
                $arr['content'] = '';
            }

            return $arr;
        });

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
