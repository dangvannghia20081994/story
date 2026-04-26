<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrawlerJob extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'story_id',
        'new_story_title',
        'source_url',
        'chapter_links_selector',
        'chapter_list_next_page_selector',
        'chapter_title_selector',
        'chapter_content_selector',
        'max_chapters',
        'chapter_start',
        'delay_seconds',
        'chapter_fetch_concurrency',
        'status',
        'chapters_imported',
        'last_error',
    ];

    protected function casts(): array
    {
        return [
            'delay_seconds' => 'float',
            'max_chapters' => 'integer',
            'chapter_start' => 'integer',
            'chapter_fetch_concurrency' => 'integer',
            'chapters_imported' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }
}
