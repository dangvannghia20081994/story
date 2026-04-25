<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    public static function genreLabel(?string $slug): string
    {
        if ($slug === null || $slug === '') {
            return '—';
        }

        return self::GENRE_LABELS[$slug] ?? $slug;
    }

    protected $fillable = [
        'title',
        'slug',
        'description',
        'genre',
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

    public function getRouteKeyName(): string
    {
        return 'id';
    }
}
