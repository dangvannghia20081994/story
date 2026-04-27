<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

/**
 * @property list<string> $genres Slug thể loại (cột JSON). Key `genre` trong JSON API là phần tử đầu (accessor).
 */
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

    /**
     * Gộp danh sách slug hợp lệ, không trùng, thứ tự theo GENRES.
     *
     * @param  list<string>|null  $genres
     * @return list<string>
     */
    public static function sanitizeGenresList(?array $genres, ?string $legacyGenre = null): array
    {
        $out = [];
        if (is_string($legacyGenre) && $legacyGenre !== '' && in_array($legacyGenre, self::GENRES, true)) {
            $out[] = $legacyGenre;
        }
        if (is_array($genres)) {
            foreach ($genres as $g) {
                if (is_string($g) && in_array($g, self::GENRES, true) && ! in_array($g, $out, true)) {
                    $out[] = $g;
                }
            }
        }
        usort(
            $out,
            static fn (string $a, string $b): int => (int) (array_search($a, self::GENRES, true) <=> array_search($b, self::GENRES, true)),
        );

        return array_values($out);
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

    /**
     * Xóa chuỗi domain nguồn crawl (ví dụ tvtruyen) khỏi nội dung chương để tránh nhắc site gốc.
     * Thay thế dài (kèm scheme) trước, rồi hostname ngắn.
     */
    public static function stripKnownRepostedSourceDomains(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        $needles = [
            'https://www.tvtruyen.co.uk',
            'http://www.tvtruyen.co.uk',
            'https://tvtruyen.co.uk',
            'http://tvtruyen.co.uk',
            '//www.tvtruyen.co.uk',
            '//tvtruyen.co.uk',
            'www.tvtruyen.co.uk',
            'tvtruyen.co.uk',
        ];

        return str_ireplace($needles, '', $text);
    }

    /**
     * Xóa nhãn/watermark nguồn crawl khỏi nội dung chương (không phân biệt hoa thường ASCII).
     */
    public static function stripKnownRepostedSourceLabels(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        $text = str_ireplace(['TruyenTV', '© Website'], '', $text);

        return str_replace(['truyện chữ', 'Truyện chữ', 'TRUYỆN CHỮ'], '', $text);
    }

    /**
     * Cắt bỏ từ cụm dụ người đọc theo dõi (thường ở cuối bản crawl) trở về cuối, kể cả cụm đó.
     */
    public static function stripFromFollowAlongNotice(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        $marker = 'Bạn đã theo dõi đến';
        $pos = mb_strpos($text, $marker, 0, 'UTF-8');
        if ($pos === false) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $pos, 'UTF-8'));
    }

    /**
     * Chuẩn hóa body chương khi lưu (CMS, API, crawler nội bộ): dòng quảng bá độc quyền + domain nguồn crawl + nhãn nguồn + cắt footer theo dõi.
     */
    public static function sanitizeChapterContent(string $text): string
    {
        $text = self::stripExclusivePublishingNoticeLines($text);
        $text = self::stripKnownRepostedSourceDomains($text);
        $text = self::stripKnownRepostedSourceLabels($text);

        return self::stripFromFollowAlongNotice($text);
    }

    protected $fillable = [
        'title',
        'slug',
        'description',
        'genres',
        'serial_status',
    ];

    /** Tổng hợp từ chương — không còn cột DB; giữ key `tts_status` cho client cũ. `genre` = thể loại đầu (tương thích API cũ). */
    protected $appends = [
        'tts_status',
        'audio_url',
        'genre',
    ];

    /** Không lộ relation phụ trong JSON (chỉ dùng cho accessor `audio_url`). */
    protected $hidden = [
        'first_audible_chapter',
    ];

    protected function casts(): array
    {
        return [
            'genres' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function setGenresAttribute(mixed $value): void
    {
        $arr = is_array($value) ? $value : [];
        $clean = self::sanitizeGenresList($arr, null);
        $this->attributes['genres'] = json_encode($clean);
    }

    /** Thể loại “chính” (đầu tiên) — client chỉ đọc một chuỗi vẫn hoạt động. */
    public function getGenreAttribute(): ?string
    {
        $g = $this->genres;
        if (! is_array($g) || $g === []) {
            return null;
        }

        return $g[0];
    }

    protected static function booted(): void
    {
        static::creating(function (Story $story): void {
            if (! array_key_exists('genres', $story->attributes)) {
                $story->setAttribute('genres', []);
            }
        });

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
        return $this->hasMany(Chapter::class)->chapterNumberSort('asc');
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
            ->chapterNumberSort('asc');
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
