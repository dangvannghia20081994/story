<?php

namespace App\Support;

/**
 * Đọc cấu hình TTS: TTS_SERVICE + danh sách voice (CMS, validation).
 */
final class TtsConfig
{
    /** @return 'vieneu'|'coqui' */
    public static function service(): string
    {
        $s = strtolower(trim((string) config('tts.service', 'vieneu')));

        return in_array($s, ['vieneu', 'coqui'], true) ? $s : 'vieneu';
    }

    /**
     * Voice theo TTS_SERVICE — dùng cho form + Rule::in.
     *
     * @return array<string, string> voice_id => nhãn hiển thị
     */
    public static function voices(): array
    {
        $svc = self::service();
        $all = config('tts.voices', []);
        if (! is_array($all)) {
            return [];
        }
        $set = $all[$svc] ?? null;

        return is_array($set) ? $set : [];
    }

    /**
     * Nhãn cho voice_id (tìm trong mọi nhóm voices — hữu ích khi đổi TTS_SERVICE nhưng DB còn mã cũ).
     */
    public static function labelFor(string $voiceId): string
    {
        $all = config('tts.voices', []);
        if (! is_array($all)) {
            return $voiceId;
        }
        foreach ($all as $set) {
            if (is_array($set) && isset($set[$voiceId]) && is_string($set[$voiceId])) {
                return $set[$voiceId];
            }
        }

        return $voiceId;
    }

    /**
     * Mặc định cho nhân vật mới: TTS_DEFAULT_VOICE_ID nếu set và nằm trong danh sách active,
     * không thì voice đầu tiên của dịch vụ đang chọn.
     */
    public static function defaultVoiceId(): string
    {
        $override = config('tts.default_voice_id');
        $voices = self::voices();
        if (is_string($override) && $override !== '' && array_key_exists($override, $voices)) {
            return $override;
        }
        $keys = array_keys($voices);

        return $keys[0] ?? '';
    }

    public static function narratorCharacterName(): string
    {
        return (string) config('tts.narrator_character_name', 'Người kể');
    }

    /** @return list<string> */
    public static function allowedVoiceIdsWithLegacy(?string $legacyVoiceId): array
    {
        $keys = array_keys(self::voices());
        if ($legacyVoiceId !== null && $legacyVoiceId !== '' && ! in_array($legacyVoiceId, $keys, true)) {
            $keys[] = $legacyVoiceId;
        }

        return array_values(array_unique($keys));
    }
}
