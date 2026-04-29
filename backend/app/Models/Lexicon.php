<?php

namespace App\Models;

use App\Services\LexiconCacheService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lexicon extends Model
{
    public const TYPE_PRONUNCIATION = 'pronunciation';

    public const TYPE_NAME = 'name';

    public const TYPE_FILTER = 'filter';

    protected $fillable = [
        'story_id',
        'word',
        'replacement',
        'type',
        'priority',
    ];

    protected function casts(): array
    {
        return [
            'story_id' => 'integer',
            'priority' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }

    protected static function booted(): void
    {
        static::saved(static function (): void {
            app(LexiconCacheService::class)->invalidate();
        });

        static::deleted(static function (): void {
            app(LexiconCacheService::class)->invalidate();
        });
    }
}
