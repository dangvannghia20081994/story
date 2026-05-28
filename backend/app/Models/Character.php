<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Character extends Model
{
    public const DEFAULT_PITCH = 0;

    public const DEFAULT_TEMPO = 1.0;

    public const VOICE_DIR = 'voices';

    public const WORKER_VOICE_MOUNT = '/app/voices';

    protected $fillable = [
        'story_id',
        'name',
        'voice_preset',
        'voice_reference_path',
        'pitch_semitones',
        'tempo_factor',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'pitch_semitones' => 'integer',
            'tempo_factor' => 'float',
            'is_system' => 'boolean',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class);
    }

    /**
     * Lookup voice cho 1 speaker trong context 1 story.
     * Trả về voice (preset key, có thể null) + voice_file (worker-mount path, có thể null).
     * Ưu tiên worker: voice_file > voice (preset) > default reference (input.wav).
     *
     * @return array{voice:?string, voice_file:?string, pitch:int, tempo:float}
     */
    public static function resolveVoiceFor(int $storyId, string $name): array
    {
        $row = static::query()
            ->where('story_id', $storyId)
            ->where('name', $name)
            ->first();

        return [
            'voice' => $row?->voice_preset ?: null,
            'voice_file' => $row?->voiceFileWorkerPath(),
            'pitch' => (int) ($row?->pitch_semitones ?? self::DEFAULT_PITCH),
            'tempo' => (float) ($row?->tempo_factor ?? self::DEFAULT_TEMPO),
        ];
    }

    /**
     * Trả về absolute path file giọng tham chiếu trên worker-tts container
     * (bind-mount /app/voices/), hoặc null nếu chưa upload.
     */
    public function voiceFileWorkerPath(): ?string
    {
        if (!is_string($this->voice_reference_path) || $this->voice_reference_path === '') {
            return null;
        }
        $base = trim($this->voice_reference_path, '/');
        // Chỉ giữ phần basename phía sau voices/ — worker mount tới voices/ rồi.
        if (str_starts_with($base, self::VOICE_DIR.'/')) {
            $base = substr($base, strlen(self::VOICE_DIR.'/'));
        }

        return self::WORKER_VOICE_MOUNT.'/'.$base;
    }
}
