<?php

namespace App\Models;

use App\Services\WorkerTtsQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class Chapter extends Model
{
    protected $fillable = [
        'story_id',
        'title',
        'chapter_number',
        'content',
        'audio_path',
        'duration',
    ];

    protected function casts(): array
    {
        return [
            'chapter_number' => 'integer',
            'duration' => 'integer',
            'tts_enqueued_at' => 'datetime',
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
        });
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
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

    public function publicAudioUrl(): ?string
    {
        if ($this->audio_path === null || $this->audio_path === '') {
            return null;
        }

        return Storage::disk('public')->url($this->audio_path);
    }

    public function hasAudioFile(): bool
    {
        $p = $this->audio_path;

        return is_string($p) && $p !== '';
    }

    /**
     * Trạng thái TTS cho CMS: audio xong, đã RPUSH Redis, chưa đẩy hàng, hoặc thiếu text.
     *
     * @return 'ready'|'queued'|'pending'|'no_text'
     */
    public function cmsTtsStatusKey(): string
    {
        if ($this->hasAudioFile()) {
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
            'ready' => 'Đã có audio',
            'queued' => 'Đã xếp hàng TTS',
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
