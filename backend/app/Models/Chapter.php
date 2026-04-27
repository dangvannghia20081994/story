<?php

namespace App\Models;

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
        'chuong',
        'content',
        'audio_path',
        'duration',
    ];

    protected function casts(): array
    {
        return [
            'chuong' => 'integer',
            'duration' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Chapter $chapter): void {
            if ($chapter->isDirty('title')) {
                $chapter->chuong = static::inferChuongFromTitle($chapter->title);
            }
        });
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }

    /**
     * Sắp xếp đọc: chương có số trước, null sau; cùng chuong thì theo updated_at rồi id.
     *
     * @param  'asc'|'desc'  $direction
     */
    public function scopeChuongSort(Builder $query, string $direction = 'asc'): Builder
    {
        $desc = strtolower($direction) === 'desc';
        $query->orderByRaw('(chuong IS NULL) ASC');
        if ($desc) {
            return $query->orderByDesc('chuong')->orderByDesc('updated_at')->orderByDesc('id');
        }

        return $query->orderBy('chuong')->orderBy('updated_at')->orderBy('id');
    }

    /**
     * Đoán số chương từ tiêu đề (Chương N, #N., v.v.).
     */
    public static function inferChuongFromTitle(?string $title): ?int
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
     * Gán lại cột chuong cho mọi chương của truyện từ tiêu đề (không đụng updated_at).
     *
     * @return int Số dòng đã cập nhật
     */
    public static function reindexChuongFromTitlesForStory(Story $story): int
    {
        $n = 0;
        DB::transaction(function () use ($story, &$n): void {
            $rows = static::query()->where('story_id', $story->id)->get(['id', 'title']);
            foreach ($rows as $row) {
                $chuong = static::inferChuongFromTitle($row->title);
                DB::table('chapters')->where('id', $row->id)->update(['chuong' => $chuong]);
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
    public static function createOrUpdateByTitleForStory(Story $story, string $title, string $content): array
    {
        $existing = static::query()
            ->where('story_id', $story->id)
            ->where('title', $title)
            ->first();

        if ($existing !== null) {
            $existing->fill(['content' => $content])->save();

            return ['chapter' => $existing->fresh(), 'created' => false];
        }

        $chapter = $story->chapters()->create([
            'title' => $title,
            'content' => $content,
        ]);

        return ['chapter' => $chapter, 'created' => true];
    }

    public function publicAudioUrl(): ?string
    {
        if ($this->audio_path === null || $this->audio_path === '') {
            return null;
        }

        return Storage::disk('public')->url($this->audio_path);
    }
}
