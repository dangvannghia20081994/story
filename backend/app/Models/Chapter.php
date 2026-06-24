<?php

namespace App\Models;

use App\Services\WorkerTtsQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class Chapter extends Model
{
    protected $hidden = ['audio_multiple_path', 'content_segments'];

    protected $fillable = [
        'story_id',
        'title',
        'chapter_number',
        'content',
        'content_segments',
        'audio_multiple_path',
        'audio_single_path',
        'duration',
        'analyzed_at',
        'coverage',
        'speaker_quality',
    ];

    protected function casts(): array
    {
        return [
            'chapter_number' => 'integer',
            'duration' => 'integer',
            'content_segments' => 'array',
            'tts_enqueued_at' => 'datetime',
            'analyzed_at' => 'datetime',
            'coverage' => 'decimal:2',
            'speaker_quality' => 'decimal:2',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Chapter $chapter): void {
            if ($chapter->isDirty('title') && ! $chapter->isDirty('chapter_number')) {
                $chapter->chapter_number = static::inferChapterNumberFromTitle($chapter->title);
            }

            $storyId = (int) ($chapter->story_id ?? 0);
            if ($storyId < 1) {
                return;
            }

            if ($chapter->isDirty('title') || $chapter->slug === null || $chapter->slug === '') {
                $chapter->slug = static::uniqueSlugForStory(
                    $storyId,
                    (string) ($chapter->title ?? ''),
                    $chapter->exists ? (int) $chapter->getKey() : null,
                );
            }
        });
    }

    /**
     * Slug duy nhất trong một truyện, suy từ tiêu đề (ASCII; trùng thì thêm -2, -3, …).
     */
    public static function uniqueSlugForStory(int $storyId, string $title, ?int $ignoreChapterId = null): string
    {
        $base = Str::slug($title) ?: 'chuong';
        $slug = $base;
        $suffix = 0;
        while (static::query()
            ->where('story_id', $storyId)
            ->where('slug', $slug)
            ->when($ignoreChapterId !== null, static fn ($q) => $q->where('id', '!=', $ignoreChapterId))
            ->exists()) {
            $suffix++;
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }

    /**
     * Vị trí đọc + chương trước/sau theo cùng thứ tự {@see scopeChapterNumberSort} (một truy vấn window, không tải toàn bộ nội dung).
     *
     * @return array{
     *     chapter: Chapter,
     *     prev: array{id:int,title:string}|null,
     *     next: array{id:int,title:string}|null,
     *     chapter_index: int,
     *     chapters_total: int
     * }|null null khi không có chương khớp story
     */
    public static function readNavigationFor(Story $story, int $chapterId): ?array
    {
        $storyId = (int) $story->id;

        $sql = <<<'SQL'
WITH ordered AS (
  SELECT
    c.*,
    COUNT(*) OVER (PARTITION BY c.story_id) AS nav_chapters_total,
    LAG(c.id) OVER w AS nav_prev_id,
    LAG(c.title) OVER w AS nav_prev_title,
    LEAD(c.id) OVER w AS nav_next_id,
    LEAD(c.title) OVER w AS nav_next_title,
    ROW_NUMBER() OVER w AS nav_chapter_index
  FROM chapters c
  WHERE c.story_id = ?
  WINDOW w AS (
    ORDER BY (CASE WHEN c.chapter_number IS NULL THEN 1 ELSE 0 END),
             c.chapter_number ASC,
             c.updated_at ASC,
             c.id ASC
  )
)
SELECT * FROM ordered WHERE id = ?
SQL;

        $row = DB::selectOne($sql, [$storyId, $chapterId]);
        if ($row === null) {
            return null;
        }

        $r = (array) $row;
        $chapterAttrs = array_intersect_key($r, array_flip([
            'id', 'story_id', 'title', 'slug', 'chapter_number', 'content', 'content_segments',
            'audio_multiple_path', 'duration', 'tts_enqueued_at', 'created_at', 'updated_at',
        ]));
        $chapter = static::hydrate([$chapterAttrs])->first();
        if ($chapter === null) {
            return null;
        }

        $prev = isset($r['nav_prev_id']) && $r['nav_prev_id'] !== null
            ? ['id' => (int) $r['nav_prev_id'], 'title' => (string) $r['nav_prev_title']]
            : null;
        $next = isset($r['nav_next_id']) && $r['nav_next_id'] !== null
            ? ['id' => (int) $r['nav_next_id'], 'title' => (string) $r['nav_next_title']]
            : null;

        return [
            'chapter' => $chapter,
            'prev' => $prev,
            'next' => $next,
            'chapter_index' => (int) $r['nav_chapter_index'],
            'chapters_total' => (int) $r['nav_chapters_total'],
        ];
    }

    /**
     * Sắp xếp đọc: có chapter_number trước, null sau; cùng số thì theo updated_at rồi id.
     *
     * @param  'asc'|'desc'  $direction
     */
    public function scopeChapterNumberSort(Builder $query, string $direction = 'asc'): Builder
    {
        $desc = strtolower($direction) === 'desc';
        $query->orderByRaw('(chapter_number IS NULL) ASC');
        if ($desc) {
            return $query->orderByDesc('chapter_number')->orderByDesc('updated_at')->orderByDesc('id');
        }

        return $query->orderBy('chapter_number')->orderBy('updated_at')->orderBy('id');
    }

    /**
     * Đoán số chương từ tiêu đề (Chương N, #N., v.v.).
     */
    public static function inferChapterNumberFromTitle(?string $title): ?int
    {
        if ($title === null || $title === '') {
            return null;
        }
        $t = trim($title);
        if (preg_match('/^#\s*(\d+)\s*[\.\):：]/u', $t, $m)) {
            $n = (int) $m[1];

            return $n >= 1 && $n < 1_000_000 ? $n : null;
        }
        if (preg_match('/Chương\s*(\d+)/iu', $t, $m)) {
            $n = (int) $m[1];

            return $n >= 1 && $n < 1_000_000 ? $n : null;
        }
        if (preg_match('/Chuong\s*(\d+)/i', $t, $m)) {
            $n = (int) $m[1];

            return $n >= 1 && $n < 1_000_000 ? $n : null;
        }

        return null;
    }

    /**
     * Gán lại chapter_number cho mọi chương của truyện từ tiêu đề (không đụng updated_at).
     *
     * @return int Số dòng đã cập nhật
     */
    public static function reindexChapterNumbersFromTitlesForStory(Story $story): int
    {
        $n = 0;
        DB::transaction(function () use ($story, &$n): void {
            $rows = static::query()->where('story_id', $story->id)->get(['id', 'title']);
            foreach ($rows as $row) {
                $num = static::inferChapterNumberFromTitle($row->title);
                DB::table('chapters')->where('id', $row->id)->update(['chapter_number' => $num]);
                $n++;
            }
        });

        return $n;
    }

    /**
     * Cùng truyện + cùng tiêu đề: cập nhật nội dung; chưa có thì tạo mới.
     *
     * @return array{chapter: Chapter, created: bool}
     */
    /**
     * @param  ?int  $chapterNumber  null = giữ cũ khi update / suy ra từ tiêu đề khi tạo (hook saving).
     */
    public static function createOrUpdateByTitleForStory(Story $story, string $title, string $content, ?int $chapterNumber = null): array
    {
        $existing = static::query()
            ->where('story_id', $story->id)
            ->where('title', $title)
            ->first();

        if ($existing !== null) {
            $existing->fill(['content' => $content]);
            if ($chapterNumber !== null) {
                $existing->chapter_number = $chapterNumber;
            }
            $existing->save();

            return ['chapter' => $existing->fresh(), 'created' => false];
        }

        $attrs = [
            'title' => $title,
            'content' => $content,
        ];
        if ($chapterNumber !== null) {
            $attrs['chapter_number'] = $chapterNumber;
        }

        $chapter = $story->chapters()->create($attrs);

        return ['chapter' => $chapter, 'created' => true];
    }

    /**
     * URL công khai trực tiếp tới /storage — chỉ còn ý nghĩa khi file legacy nằm trên disk public.
     *
     * @deprecated Dùng cho CMS / debug; client nên dùng {@see signedAudioStreamUrl}.
     */
    public function publicAudioUrl(): ?string
    {
        if ($this->audio_multiple_path === null || $this->audio_multiple_path === '') {
            return null;
        }
        if (! Storage::disk('public')->exists($this->audio_multiple_path)) {
            return null;
        }

        return Storage::disk('public')->url($this->audio_multiple_path);
    }

    /**
     * URL có chữ ký thời hạn để phát audio (GET stream + Range).
     */
    public function signedAudioStreamUrl(): ?string
    {
        if (! $this->hasAudioFile()) {
            return null;
        }
        if ($this->resolveAudioFileAbsolutePath() === null) {
            return null;
        }

        $minutes = (int) config('chapter_audio.signed_url_ttl_minutes', 30);
        $this->loadMissing('story');
        $story = $this->story;
        if ($story === null) {
            return null;
        }

        $storyKey = $story->getRouteKey();
        $chapterKey = (is_string($this->slug) && $this->slug !== '') ? $this->slug : (string) $this->getKey();

        return URL::temporarySignedRoute(
            'api.stories.chapters.audio.stream',
            now()->addMinutes(max(1, $minutes)),
            [
                'story' => $storyKey,
                'chapter_slug' => $chapterKey,
            ],
        );
    }

    /**
     * @return array{absolute: string, extension: string}|null
     */
    public function resolveAudioFileAbsolutePath(): ?array
    {
        // Ưu tiên audio_single_path, fallback audio_multiple_path
        $candidates = array_filter([
            $this->audio_single_path,
            $this->audio_multiple_path,
        ], static fn ($v) => is_string($v) && $v !== '');

        $disks = ['local', 'public'];
        foreach ($candidates as $relative) {
            foreach ($disks as $diskName) {
                $disk = Storage::disk($diskName);
                if (! $disk->exists($relative)) {
                    continue;
                }
                $absolute = $disk->path($relative);
                $extension = strtolower(pathinfo($relative, PATHINFO_EXTENSION));

                return ['absolute' => $absolute, 'extension' => $extension !== '' ? $extension : 'bin'];
            }
        }

        return null;
    }

    public function hasAudioFile(): bool
    {
        return (is_string($this->audio_single_path) && $this->audio_single_path !== '')
            || (is_string($this->audio_multiple_path) && $this->audio_multiple_path !== '');
    }

    /**
     * Có audio 1-giọng (audio_single_path) — pipeline TTS hiện tại.
     * audio_multiple_path để dành phase "đa vai" sau, KHÔNG tính ở trạng thái CMS.
     */
    public function hasSingleAudio(): bool
    {
        return is_string($this->audio_single_path) && $this->audio_single_path !== '';
    }

    /**
     * Trạng thái TTS cho CMS: audio xong, đã RPUSH Redis, chưa đẩy hàng, hoặc thiếu text.
     *
     * @return 'ready'|'queued'|'pending'|'no_text'
     */
    public function cmsTtsStatusKey(): string
    {
        if ($this->hasSingleAudio()) {
            return 'ready';
        }
        if (WorkerTtsQueue::plainTextFromChapter($this) === '') {
            return 'no_text';
        }
        if ($this->tts_enqueued_at !== null) {
            return 'queued';
        }

        return 'pending';
    }

    public function cmsTtsStatusLabel(): string
    {
        return match ($this->cmsTtsStatusKey()) {
            'ready' => 'Hoàn tất',
            'queued' => 'Đã xếp hàng',
            'pending' => 'Chưa đẩy hàng',
            'no_text' => 'Thiếu nội dung',
        };
    }

    public function cmsTtsBadgeClass(): string
    {
        return match ($this->cmsTtsStatusKey()) {
            'ready' => 'cms-badge--tts-ready',
            'queued' => 'cms-badge--job-queued',
            'pending' => 'cms-badge--tts-pending',
            'no_text' => 'cms-badge--tts-muted',
        };
    }

    /** Có thể RPUSH job worker-tts (có plain text sau khi strip HTML). */
    public function canEnqueueWorkerTts(): bool
    {
        return $this->cmsTtsStatusKey() !== 'no_text';
    }
}
