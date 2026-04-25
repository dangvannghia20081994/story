<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Chapter extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PROCESSING = 'processing';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'story_id',
        'title',
        'content',
        'audio_path',
        'status',
        'duration',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'duration' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }

    public function publicAudioUrl(): ?string
    {
        if ($this->audio_path === null || $this->audio_path === '') {
            return null;
        }

        return Storage::disk('public')->url($this->audio_path);
    }
}
