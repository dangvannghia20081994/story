<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Chapter extends Model
{
    protected $fillable = [
        'story_id',
        'title',
        'content',
        'audio_path',
        'duration',
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
