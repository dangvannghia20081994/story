<?php

namespace App\Services;

use App\Models\Character;
use App\Models\Story;
use App\Support\TtsConfig;

class VoiceSegmentBuilder
{
    /**
     * MVP: một segment toàn bộ chương với giọng narrator (nhân vật cấu hình hoặc default).
     * Giai đoạn sau: tách theo nhân vật / thoại.
     *
     * @return list<array{voice_id: string, text: string, pitch: float, rate: float}>
     */
    public function build(Story $story, string $preprocessedText): array
    {
        $narratorName = TtsConfig::narratorCharacterName();
        $defaultVoice = TtsConfig::defaultVoiceId();

        $narrator = Character::query()
            ->where('story_id', $story->id)
            ->where('name', $narratorName)
            ->first();

        $voiceId = $narrator?->voice_id ?? $defaultVoice;
        $pitch = $narrator !== null ? (float) $narrator->pitch : 1.0;
        $rate = $narrator !== null ? (float) $narrator->rate : 1.0;

        return [[
            'voice_id' => $voiceId,
            'text' => $preprocessedText,
            'pitch' => $pitch,
            'rate' => $rate,
        ]];
    }
}
