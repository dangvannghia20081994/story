<?php

namespace App\Services;

use App\Models\Character;
use App\Models\Story;
use App\Support\TtsConfig;
use Illuminate\Support\Collection;

class VoiceSegmentBuilder
{
    /**
     * Tách nội dung chương thành các segment TTS theo giọng từng nhân vật.
     *
     * **Ưu tiên:** sau khi chuẩn hoá dấu ngoặc (dấu “ ” « » … → `"`), nếu **cả chương** có số dấu `"` ASCII **chẵn và ≥ 2**,
     * tách thoại trên **toàn bộ nội dung** (một khối dài, không cần đoạn cách nhau bằng dòng trống, vẫn tách được nhiều giọng).
     * Ngược lại: chia theo **đoạn** (một hoặc nhiều dòng trắng) và xử lý từng đoạn như dưới.
     *
     * Trong mỗi đoạn (khi không dùng nhánh toàn chương):
     * - Nếu có **ít nhất một cặp** dấu ngoặc kép ASCII `"` (tiểu thuyết — thoại trong `"..."`):
     *   phần **ngoài** ngoặc → giọng **người kể**; phần **trong** ngoặc → giọng nhân vật nếu tìm được **tên**
     *   trên **dòng không trống cuối cùng** ngay trước dấu `"` mở (so khớp không phân biệt hoa thường, ưu tiên tên xuất hiện **sớm** trên dòng;
     *   nhiều tên trùng vị trí thì ưu tiên tên **dài** hơn). Không tìm được → người kể đọc luôn câu thoại.
     * - Ngược lại (không đủ cặp `"`): nếu **dòng đầu** là `Tên:` / `Tên：` và `Tên` trùng nhân vật → phần sau dòng đầu dùng giọng đó; cả đoạn không khớp → người kể.
     *
     * Các segment liền nhau cùng `voice_id` được gộp.
     *
     * @return list<array{voice_id: string, text: string, pitch: float, rate: float}>
     */
    public function build(Story $story, string $preprocessedText): array
    {
        $narratorName = TtsConfig::narratorCharacterName();
        $defaultVoice = TtsConfig::defaultVoiceId();

        /** @var Collection<string, Character> $byName */
        $byName = Character::query()
            ->where('story_id', $story->id)
            ->get()
            ->keyBy(fn (Character $c) => $this->normName($c->name));

        $characters = Character::query()->where('story_id', $story->id)->get();

        $narrator = $byName->get($this->normName($narratorName));
        $narratorVoice = $narrator?->voice_id ?? $defaultVoice;
        $narratorPitch = $narrator !== null ? (float) $narrator->pitch : 1.0;
        $narratorRate = $narrator !== null ? (float) $narrator->rate : 1.0;

        $work = $this->normalizeAsciiDoubleQuotes($preprocessedText);
        $trimmed = trim($work);
        if ($trimmed === '') {
            return [[
                'voice_id' => $narratorVoice,
                'text' => '',
                'pitch' => $narratorPitch,
                'rate' => $narratorRate,
            ]];
        }

        if ($this->hasBalancedAsciiQuotes($trimmed)) {
            $segments = [];
            foreach ($this->segmentsFromQuotedNovelBlock(
                $trimmed,
                $characters,
                $narratorVoice,
                $narratorPitch,
                $narratorRate,
            ) as $seg) {
                $segments[] = $seg;
            }
            if ($segments !== []) {
                return $this->mergeAdjacentSameVoice($segments);
            }
        }

        $blocks = preg_split('/\R{2,}/u', $work, -1, PREG_SPLIT_NO_EMPTY);
        if ($blocks === false) {
            $blocks = [$preprocessedText];
        }

        $segments = [];
        foreach ($blocks as $block) {
            $block = trim($block);
            if ($block === '') {
                continue;
            }
            if ($this->hasBalancedAsciiQuotes($block)) {
                foreach ($this->segmentsFromQuotedNovelBlock(
                    $block,
                    $characters,
                    $narratorVoice,
                    $narratorPitch,
                    $narratorRate,
                ) as $seg) {
                    $segments[] = $seg;
                }
            } else {
                $seg = $this->segmentFromColonBlock(
                    $block,
                    $byName,
                    $narratorVoice,
                    $narratorPitch,
                    $narratorRate,
                );
                if ($seg !== null) {
                    $segments[] = $seg;
                }
            }
        }

        if ($segments === []) {
            return [[
                'voice_id' => $narratorVoice,
                'text' => $trimmed,
                'pitch' => $narratorPitch,
                'rate' => $narratorRate,
            ]];
        }

        return $this->mergeAdjacentSameVoice($segments);
    }

    /**
     * @return list<array{voice_id: string, text: string, pitch: float, rate: float}>
     */
    private function segmentsFromQuotedNovelBlock(
        string $block,
        Collection $characters,
        string $narratorVoice,
        float $narratorPitch,
        float $narratorRate,
    ): array {
        $out = [];
        $narrBuf = '';
        $len = mb_strlen($block, 'UTF-8');
        $i = 0;
        while ($i < $len) {
            $ch = mb_substr($block, $i, 1, 'UTF-8');
            if ($ch !== '"') {
                $narrBuf .= $ch;
                $i++;

                continue;
            }
            $this->flushNarration($out, $narrBuf, $narratorVoice, $narratorPitch, $narratorRate);
            $narrBuf = '';

            $close = $this->findClosingAsciiQuote($block, $i + 1, $len);
            if ($close === null) {
                $narrBuf .= mb_substr($block, $i, $len - $i, 'UTF-8');
                break;
            }
            $before = mb_substr($block, 0, $i, 'UTF-8');
            $inner = mb_substr($block, $i + 1, $close - $i - 1, 'UTF-8');
            $innerTrim = trim($inner);
            if ($innerTrim !== '') {
                $speaker = $this->resolveSpeakerFromContextBeforeQuote($before, $characters);
                if ($speaker !== null) {
                    $out[] = [
                        'voice_id' => $speaker->voice_id,
                        'text' => $innerTrim,
                        'pitch' => (float) $speaker->pitch,
                        'rate' => (float) $speaker->rate,
                    ];
                } else {
                    $out[] = [
                        'voice_id' => $narratorVoice,
                        'text' => $innerTrim,
                        'pitch' => $narratorPitch,
                        'rate' => $narratorRate,
                    ];
                }
            }
            $i = $close + 1;
        }
        $this->flushNarration($out, $narrBuf, $narratorVoice, $narratorPitch, $narratorRate);

        return $out;
    }

    /**
     * @param list<array{voice_id: string, text: string, pitch: float, rate: float}> $out
     */
    private function flushNarration(
        array &$out,
        string $narrBuf,
        string $narratorVoice,
        float $narratorPitch,
        float $narratorRate,
    ): void {
        $t = trim($narrBuf);
        if ($t === '') {
            return;
        }
        $out[] = [
            'voice_id' => $narratorVoice,
            'text' => $t,
            'pitch' => $narratorPitch,
            'rate' => $narratorRate,
        ];
    }

    private function findClosingAsciiQuote(string $block, int $start, int $len): ?int
    {
        for ($j = $start; $j < $len; $j++) {
            if (mb_substr($block, $j, 1, 'UTF-8') === '"') {
                return $j;
            }
        }

        return null;
    }

    private function hasBalancedAsciiQuotes(string $block): bool
    {
        $n = substr_count($block, '"');

        return $n >= 2 && $n % 2 === 0;
    }

    /**
     * @param Collection<int, Character> $characters
     */
    private function resolveSpeakerFromContextBeforeQuote(string $before, Collection $characters): ?Character
    {
        $lines = preg_split('/\R/u', $before) ?: [];
        $last = '';
        for ($k = count($lines) - 1; $k >= 0; $k--) {
            $line = trim($lines[$k]);
            if ($line !== '') {
                $last = $line;
                break;
            }
        }
        if ($last === '') {
            return null;
        }

        return $this->firstCharacterNameInLine($last, $characters);
    }

    /**
     * Tên nhân vật xuất hiện sớm nhất trên dòng; nếu cùng vị trí thì tên dài hơn (tránh khớp từng phần ngắn trước tên đầy đủ).
     *
     * @param Collection<int, Character> $characters
     */
    private function firstCharacterNameInLine(string $line, Collection $characters): ?Character
    {
        $best = null;
        $bestPos = PHP_INT_MAX;
        $bestLen = -1;
        foreach ($characters as $c) {
            $name = $c->name;
            if ($name === '') {
                continue;
            }
            $pos = mb_stripos($line, $name, 0, 'UTF-8');
            if ($pos === false) {
                continue;
            }
            $nlen = mb_strlen($name, 'UTF-8');
            if ($pos < $bestPos || ($pos === $bestPos && $nlen > $bestLen)) {
                $best = $c;
                $bestPos = $pos;
                $bestLen = $nlen;
            }
        }

        return $best;
    }

    /**
     * @param Collection<string, Character> $byName
     *
     * @return array{voice_id: string, text: string, pitch: float, rate: float}|null
     */
    private function segmentFromColonBlock(
        string $block,
        Collection $byName,
        string $narratorVoice,
        float $narratorPitch,
        float $narratorRate,
    ): ?array {
        $lines = preg_split('/\R/u', $block) ?: [$block];
        $first = $lines[0] ?? '';
        $voiceId = $narratorVoice;
        $pitch = $narratorPitch;
        $rate = $narratorRate;
        $body = $block;

        if (preg_match('/^(.+?)[:：]\s*(.*)$/u', $first, $m)) {
            $speakerKey = $this->normName($m[1]);
            $char = $byName->get($speakerKey);
            if ($char !== null) {
                $voiceId = $char->voice_id;
                $pitch = (float) $char->pitch;
                $rate = (float) $char->rate;
                $restFirst = $m[2];
                $restLines = array_slice($lines, 1);
                $body = trim($restFirst.(count($restLines) > 0 ? "\n".implode("\n", $restLines) : ''));
            }
        }

        if ($body === '') {
            return null;
        }

        return [
            'voice_id' => $voiceId,
            'text' => $body,
            'pitch' => $pitch,
            'rate' => $rate,
        ];
    }

    /**
     * @param list<array{voice_id: string, text: string, pitch: float, rate: float}> $segments
     *
     * @return list<array{voice_id: string, text: string, pitch: float, rate: float}>
     */
    private function mergeAdjacentSameVoice(array $segments): array
    {
        $out = [];
        foreach ($segments as $seg) {
            $lastKey = array_key_last($out);
            $prev = $lastKey !== null ? $out[$lastKey] : null;
            if ($prev !== null && ($prev['voice_id'] ?? '') === ($seg['voice_id'] ?? '')) {
                $out[$lastKey]['text'] = $prev['text']."\n\n".$seg['text'];
            } else {
                $out[] = $seg;
            }
        }

        return $out;
    }

    private function normName(string $name): string
    {
        return mb_strtolower(trim($name), 'UTF-8');
    }

    /**
     * Đưa dấu ngoặc kiểu sách / Unicode về ASCII 0x22 để đếm cặp và tách thoại ổn định.
     */
    private function normalizeAsciiDoubleQuotes(string $s): string
    {
        static $map = [
            "\u{201C}" => '"', // “
            "\u{201D}" => '"', // ”
            "\u{201E}" => '"', // „
            "\u{00AB}" => '"', // «
            "\u{00BB}" => '"', // »
            "\u{2039}" => '"', // ‹
            "\u{203A}" => '"', // ›
            "\u{FF02}" => '"', // ＂ fullwidth
        ];

        return strtr($s, $map);
    }
}
