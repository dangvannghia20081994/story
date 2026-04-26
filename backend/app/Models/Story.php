<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Story extends Model
{
    public const GENRES = [
        'tu-tien',
        'huyen-huyen',
        'kiem-hiep',
        'do-thi',
        'khac',
    ];

    /** @var array<string, string> slug DB => nhãn hiển thị (CMS, UI) */
    public const GENRE_LABELS = [
        'tu-tien' => 'Tu tiên',
        'huyen-huyen' => 'Huyền huyễn',
        'kiem-hiep' => 'Kiếm hiệp',
        'do-thi' => 'Đô thị',
        'khac' => 'Khác',
    ];

    public const SERIAL_STATUSES = [
        'ongoing',
        'completed',
    ];

    public const SERIAL_STATUS_LABELS = [
        'ongoing' => 'Đang ra',
        'completed' => 'Hoàn thành',
    ];

    public static function genreLabel(?string $slug): string
    {
        if ($slug === null || $slug === '') {
            return '—';
        }

        return self::GENRE_LABELS[$slug] ?? $slug;
    }

    public static function serialStatusLabel(?string $status): string
    {
        if ($status === null || $status === '') {
            return '—';
        }

        return self::SERIAL_STATUS_LABELS[$status] ?? $status;
    }

    /**
     * Bỏ cả dòng nếu (sau khoảng trắng đầu dòng) bắt đầu bằng câu quảng bá đăng tải duy nhất.
     * Một số bản ghi là “... duy nhất tại …”, số khác dừng ở “... duy nhất” nên dùng tiền tố ngắn hơn, không bắt buộc “ tại”.
     */
    public static function stripExclusivePublishingNoticeLines(string $text): string
    {
        $prefix = 'Truyện được đăng tải duy nhất';
        $lines = preg_split('/\R/u', $text) ?: [];
        $out = [];
        foreach ($lines as $line) {
            $forCheck = preg_replace('/^[\x{FEFF}\x{200B}-\x{200D}\p{Zs}\s]+/u', '', $line) ?? $line;
            if (str_starts_with($forCheck, $prefix)) {
                continue;
            }
            $out[] = $line;
        }

        return implode("\n", $out);
    }

    protected $fillable = [
        'title',
        'slug',
        'description',
        'genre',
        'serial_status',
    ];

    /** Tổng hợp từ chương — không còn cột DB; giữ key `tts_status` cho client cũ. */
    protected $appends = [
        'tts_status',
        'audio_url',
    ];

    /** Không lộ relation phụ trong JSON (chỉ dùng cho accessor `audio_url`). */
    protected $hidden = [
        'first_audible_chapter',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Story $story): void {
            if ($story->exists && ($story->slug === null || $story->slug === '')) {
                $base = Str::slug($story->title) ?: 'story';
                $story->slug = $base.'-'.$story->id;
            }
        });

        static::created(function (Story $story): void {
            if ($story->slug !== null && $story->slug !== '') {
                return;
            }
            $base = Str::slug($story->title) ?: 'story';
            $story->forceFill(['slug' => $base.'-'.$story->id])->saveQuietly();
        });
    }

    public function chapters(): HasMany
    {
        return $this->hasMany(Chapter::class);
    }

    public function characters(): HasMany
    {
        return $this->hasMany(Character::class);
    }

    /** Chương đầu tiên có file audio (cho danh sách truyện). */
    public function firstAudibleChapter(): HasOne
    {
        return $this->hasOne(Chapter::class)
            ->whereNotNull('audio_path')
            ->where('audio_path', '<>', '')
            ->orderBy('id');
    }

    public function getTtsStatusAttribute(): string
    {
        if ($this->relationLoaded('chapters')) {
            $chapters = $this->chapters;
            $total = $chapters->count();
            if ($total === 0) {
                return 'pending';
            }
            $with = $chapters->filter(fn (Chapter $c) => $c->audio_path !== null && $c->audio_path !== '')->count();
            if ($with >= $total) {
                return 'completed';
            }
            if ($with > 0) {
                return 'processing';
            }

            return 'pending';
        }

        $total = (int) ($this->chapters_count ?? 0);
        if ($total === 0) {
            return 'pending';
        }
        $with = (int) ($this->chapters_with_audio_count ?? 0);
        if ($with >= $total) {
            return 'completed';
        }
        if ($with > 0) {
            return 'processing';
        }

        return 'pending';
    }

    public function getAudioUrlAttribute(): ?string
    {
        if ($this->relationLoaded('firstAudibleChapter') && $this->firstAudibleChapter) {
            return $this->firstAudibleChapter->publicAudioUrl();
        }
        if ($this->relationLoaded('chapters')) {
            $first = $this->chapters->first(fn (Chapter $c) => $c->audio_path !== null && $c->audio_path !== '');

            return $first ? $first->publicAudioUrl() : null;
        }

        return null;
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** Trang chi tiết truyện trên site công khai (Next) — cùng quy ước với @/lib/storyPath. */
    public function frontendDetailUrl(): string
    {
        $root = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');
        $key = (is_string($this->slug) && $this->slug !== '') ? $this->slug : (string) $this->id;

        return $root.'/stories/'.rawurlencode($key);
    }
}
