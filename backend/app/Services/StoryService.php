<?php

namespace App\Services;

use App\Http\Requests\Cms\ListCmsStoriesRequest;
use App\Http\Requests\Api\ListStoriesRequest;
use App\Http\Requests\Api\ShowStoryRequest;
use App\Models\Chapter;
use App\Models\Story;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class StoryService
{
    /**
     * Danh sách truyện cho site đọc (frontend): nhiều bộ lọc / sort / exclude / has_audio …
     */
    public function paginateForPublicApi(ListStoriesRequest $request): LengthAwarePaginator
    {
        $perPage = (int) $request->input('per_page', 20);
        $perPage = min(100, max(1, $perPage));

        $excludeId = $request->filled('exclude') ? (int) $request->input('exclude') : null;

        $genreSlugs = [];
        $genreCsv = $request->input('genres');
        if (! is_string($genreCsv) || trim($genreCsv) === '') {
            $genreCsv = $request->input('any_genre');
        }
        if (is_string($genreCsv) && trim($genreCsv) !== '') {
            foreach (explode(',', $genreCsv) as $part) {
                $s = trim((string) $part);
                if ($s !== '' && in_array($s, Story::GENRES, true)) {
                    $genreSlugs[] = $s;
                }
            }
            $genreSlugs = array_values(array_unique($genreSlugs));
        }

        $query = Story::query()
            ->with(['firstAudibleChapter' => fn ($q) => $q->select(['id', 'story_id', 'audio_path'])])
            ->withCount([
                'chapters',
                'chapters as chapters_with_audio_count' => fn ($q) => $q->whereNotNull('audio_path')->where('audio_path', '<>', ''),
            ]);

        $sort = (string) $request->input('sort', 'created_desc');
        match ($sort) {
            'created_asc' => $query->reorder()->orderBy('created_at')->orderBy('id'),
            'id_asc' => $query->reorder()->orderBy('id'),
            'id_desc' => $query->reorder()->orderByDesc('id'),
            default => $query->reorder()->orderByDesc('created_at')->orderByDesc('id'),
        };

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        if ($genreSlugs !== []) {
            $query->where(function ($q) use ($genreSlugs): void {
                foreach ($genreSlugs as $slug) {
                    $q->orWhereJsonContains('genres', $slug);
                }
            });
        }

        $qTitle = trim((string) $request->input('q', ''));
        if ($qTitle !== '') {
            $query->where('title', 'like', '%'.$qTitle.'%');
        }

        if ($request->filled('serial_status')) {
            $query->where('serial_status', (string) $request->input('serial_status'));
        }

        if ($request->input('has_audio') === 'yes') {
            $query->whereHas(
                'chapters',
                fn ($q) => $q->whereNotNull('audio_path')->where('audio_path', '<>', ''),
            );
        } elseif ($request->input('has_audio') === 'no') {
            $query->whereDoesntHave(
                'chapters',
                fn ($q) => $q->whereNotNull('audio_path')->where('audio_path', '<>', ''),
            );
        }

        return $query->paginate($perPage);
    }

    /**
     * Chuẩn hóa tham số lọc thể loại một slug trên CMS (Blade + JSON).
     */
    public function normalizeCmsGenreFilter(mixed $genreParam): string
    {
        if (! is_string($genreParam) || trim($genreParam) === '') {
            return '';
        }
        $g = trim($genreParam);

        return in_array($g, Story::GENRES, true) ? $g : '';
    }

    /**
     * Phân trang danh sách truyện CMS — dùng chung màn Blade /admin/stories và GET /api/cms/stories.
     *
     * @param  string  $genreSlug  Slug thể loại hợp lệ hoặc '' (nên dùng normalizeCmsGenreFilter trước khi gọi).
     */
    public function paginateCmsStoryList(string $q, string $genreSlug, int $perPage): LengthAwarePaginator
    {
        $perPage = min(100, max(1, $perPage));
        $qTrim = trim($q);

        $query = Story::query()
            ->withCount(['chapters', 'characters'])
            ->when(
                $qTrim !== '',
                static function ($builder) use ($qTrim): void {
                    $like = '%'.addcslashes($qTrim, '%_\\').'%';
                    $builder->where('title', 'like', $like);
                }
            )
            ->when(
                $genreSlug !== '',
                static fn ($builder) => $builder->whereJsonContains('genres', $genreSlug)
            )
            ->orderByDesc('id');

        return $query->paginate($perPage);
    }

    /**
     * Danh sách truyện cho CMS (JSON): q, genre, per_page — cùng lõi với {@see paginateCmsStoryList}.
     */
    public function paginateForCmsApi(ListCmsStoriesRequest $request): LengthAwarePaginator
    {
        $genre = $this->normalizeCmsGenreFilter($request->input('genre'));

        return $this->paginateCmsStoryList(
            (string) $request->input('q', ''),
            $genre,
            (int) $request->input('per_page', 20),
        );
    }

    /**
     * @param  array<string, mixed>  $data  Đã validate (store API): title, slug?, description?, genres?, genre?, serial_status?, first_chapter?
     */
    public function createWithOptionalFirstChapter(array $data): Story
    {
        if (isset($data['description']) && is_string($data['description']) && $data['description'] !== '') {
            $data['description'] = Story::stripExclusivePublishingNoticeLines($data['description']);
            if (trim($data['description']) === '') {
                $data['description'] = null;
            }
        }
        if (! empty($data['first_chapter']['content']) && is_string($data['first_chapter']['content'])) {
            $data['first_chapter']['content'] = Story::sanitizeChapterContent($data['first_chapter']['content']);
        }

        return DB::transaction(function () use ($data) {
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
    }

    /**
     * Payload JSON cho GET story (public API).
     *
     * @return array<string, mixed>
     */
    public function buildShowResponse(ShowStoryRequest $request, Story $story): array
    {
        $data = $request->validated();

        $chaptersWithAudioTotal = $story->chapters()
            ->whereNotNull('audio_path')
            ->where('audio_path', '<>', '')
            ->count();

        $readChapterSlug = isset($data['read_chapter_slug']) ? trim((string) $data['read_chapter_slug']) : '';
        $readChapterId = isset($data['read_chapter']) ? (int) $data['read_chapter'] : null;
        if ($readChapterSlug !== '') {
            $bySlug = Chapter::query()
                ->where('story_id', $story->id)
                ->where('slug', $readChapterSlug)
                ->first();
            if ($bySlug === null) {
                abort(404);
            }
            $readChapterId = (int) $bySlug->id;
        }

        if ($readChapterId !== null) {
            $nav = Chapter::readNavigationFor($story, $readChapterId);
            if ($nav === null) {
                abort(404);
            }
            $story->unsetRelation('chapters');
            $story->loadCount('characters');
            $c = $nav['chapter'];

            return [
                'data' => array_merge($story->toArray(), [
                    'chapters' => [],
                    'chapters_total' => $nav['chapters_total'],
                    'chapters_with_audio_total' => $chaptersWithAudioTotal,
                    'read_chapter' => array_merge($c->toArray(), [
                        'audio_url' => $c->signedAudioStreamUrl(),
                    ]),
                    'read_navigation' => [
                        'chapter_index' => $nav['chapter_index'],
                        'chapters_total' => $nav['chapters_total'],
                        'prev' => $this->enrichReadNeighbor($nav['prev']),
                        'next' => $this->enrichReadNeighbor($nav['next']),
                    ],
                ]),
            ];
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
                    'id', 'story_id', 'title', 'slug', 'chapter_number', 'audio_path',
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
                'audio_url' => $c->signedAudioStreamUrl(),
            ]);
            if ($chaptersOmitContent) {
                $arr['content'] = '';
            }

            return $arr;
        });

        return [
            'data' => array_merge($story->toArray(), [
                'chapters' => $chapters,
                'chapters_total' => $chaptersTotal,
                'chapters_with_audio_total' => $chaptersWithAudioTotal,
            ]),
        ];
    }

    /**
     * @param  array<string, mixed>  $data  Đã validate (update API)
     */
    public function updateFromValidated(Story $story, array $data): Story
    {
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

        return $story->fresh()->loadCount('chapters');
    }

    /**
     * Tạo truyện từ dữ liệu CMS đã validate (StoreStoryRequest): first_chapter_title / first_chapter_content.
     *
     * @param  array<string, mixed>  $validated
     */
    public function createFromCmsValidated(array $validated): void
    {
        $slug = $validated['slug'] ?? null;
        if ($slug === '') {
            $slug = null;
        }

        $firstChapter = null;
        if (! empty($validated['first_chapter_title']) && ! empty($validated['first_chapter_content'])) {
            $firstChapter = [
                'title' => $validated['first_chapter_title'],
                'content' => $validated['first_chapter_content'],
            ];
        }

        DB::transaction(function () use ($validated, $slug, $firstChapter): void {
            $story = Story::query()->create([
                'title' => $validated['title'],
                'slug' => $slug,
                'description' => $validated['description'] ?? null,
                'genres' => Story::sanitizeGenresList($validated['genres'] ?? null, null),
                'serial_status' => $validated['serial_status'] ?? 'ongoing',
            ]);

            if ($firstChapter !== null) {
                Chapter::createOrUpdateByTitleForStory(
                    $story,
                    $firstChapter['title'],
                    $firstChapter['content'],
                );
            }
        });
    }

    /**
     * @param  array<string, mixed>  $validated  UpdateStoryRequest
     */
    public function updateFromCmsValidated(Story $story, array $validated): void
    {
        if (array_key_exists('slug', $validated) && ($validated['slug'] === null || $validated['slug'] === '')) {
            $validated['slug'] = Str::slug($story->title).'-'.$story->id;
        }

        $story->fill($validated)->save();
    }

    /**
     * @param  array<string, mixed>|null  $meta
     * @return array<string, mixed>|null
     */
    private function enrichReadNeighbor(?array $meta): ?array
    {
        if ($meta === null) {
            return null;
        }
        $row = Chapter::query()->where('id', $meta['id'])->first();
        if ($row === null) {
            return null;
        }

        return array_merge($row->toArray(), [
            'audio_url' => $row->signedAudioStreamUrl(),
        ]);
    }
}
