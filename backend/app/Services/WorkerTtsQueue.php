<?php

namespace App\Services;

use App\Models\Chapter;
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

        $payload = ['chapter_id' => $chapter->id, 'text' => $text];

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
