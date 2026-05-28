<?php

namespace App\Services;

use App\Models\Chapter;
use App\Models\Character;
use Illuminate\Support\Facades\Redis;

class WorkerTtsQueue
{
    /**
     * Đưa job TTS vào Redis để worker-tts BLPOP xử lý.
     *
     * @param  array<string, mixed>|null  $overrides  Ghi đè payload (vd. ['text' => '...'])
     */
    public static function push(Chapter $chapter, ?array $overrides = null): void
    {
        $text = self::plainTextFromChapter($chapter);
        if (is_array($overrides) && isset($overrides['text']) && is_string($overrides['text']) && $overrides['text'] !== '') {
            $text = $overrides['text'];
        }
        $lexicons = app(LexiconCacheService::class)->mergedOrderedForStory((int) $chapter->story_id);
        $text = app(LexiconTextService::class)->applyToPlainText($text, $lexicons);

        $payload = ['chapter_id' => $chapter->id, 'mode' => 'single', 'text' => $text];

        $key = config('worker_tts.redis_queue_list');
        $json = json_encode($payload, JSON_THROW_ON_ERROR);

        Redis::rpush($key, $json);

        Chapter::query()->whereKey($chapter->getKey())->update([
            'tts_enqueued_at' => now(),
        ]);
    }

    /**
     * Đưa job multi-speaker TTS vào Redis.
     * Payload chứa segments[] đã được resolve voice mapping + apply lexicon từng segment.
     */
    public static function pushMultiSpeaker(Chapter $chapter): void
    {
        $segments = $chapter->content_segments ?? [];
        if (!is_array($segments) || empty($segments)) {
            throw new \RuntimeException("Chapter {$chapter->id} không có content_segments — chưa analyze.");
        }

        $storyId = (int) $chapter->story_id;
        $lexicons = app(LexiconCacheService::class)->mergedOrderedForStory($storyId);
        $lexiconService = app(LexiconTextService::class);

        $resolvedSegments = [];
        foreach ($segments as $seg) {
            $speaker = (string) ($seg['speaker'] ?? 'narration');
            $text = trim((string) ($seg['text'] ?? ''));
            if ($text === '') {
                continue;
            }
            // Apply lexicon per segment để TTS đọc đúng (tên alias, từ phiên âm,…)
            $text = $lexiconService->applyToPlainText($text, $lexicons);

            $mapping = Character::resolveVoiceFor($storyId, $speaker);

            $resolvedSegments[] = [
                'speaker' => $speaker,
                'text' => $text,
                'voice' => $mapping['voice'],
                'voice_file' => $mapping['voice_file'],
                'pitch' => $mapping['pitch'],
                'tempo' => $mapping['tempo'],
            ];
        }

        if (empty($resolvedSegments)) {
            throw new \RuntimeException("Chapter {$chapter->id} không có segment hợp lệ sau khi filter.");
        }

        $payload = [
            'chapter_id' => $chapter->id,
            'mode' => 'multi-speaker',
            'segments' => $resolvedSegments,
        ];

        $key = config('worker_tts.redis_queue_list');
        $json = json_encode($payload, JSON_THROW_ON_ERROR);

        Redis::rpush($key, $json);

        Chapter::query()->whereKey($chapter->getKey())->update([
            'tts_enqueued_at' => now(),
        ]);
    }

    /**
     * Lấy plain text từ HTML nội dung chương (cho TTS).
     */
    public static function plainTextFromChapter(Chapter $chapter): string
    {
        $html = (string) ($chapter->content ?? '');
        $normalized = preg_replace('/<\\s*br\\s*\\/?>/i', "\n", $html) ?? $html;
        $plain = strip_tags($normalized);
        $plain = html_entity_decode($plain, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $plain = preg_replace('/[\x{200B}\x{200C}\x{200D}\x{FEFF}]/u', '', $plain) ?? $plain;
        $plain = preg_replace('/[ \t\x{00A0}]+/u', ' ', $plain) ?? $plain;
        $plain = preg_replace('/\R+/u', "\n", $plain) ?? $plain;
        $lines = preg_split('/\R/u', $plain) ?: [];
        $nonEmpty = [];
        foreach ($lines as $line) {
            $t = trim((string) $line);
            if ($t !== '') {
                $nonEmpty[] = $t;
            }
        }
        $plain = implode(' ', $nonEmpty);
        $plain = preg_replace('/\s+/u', ' ', $plain) ?? $plain;

        return trim($plain);
    }
}
