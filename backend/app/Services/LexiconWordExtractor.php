<?php

namespace App\Services;

/**
 * Trích các đơn vị từ (chuỗi chữ/số) từ HTML hoặc plain text để gợi ý lexicon.
 */
final class LexiconWordExtractor
{
    /**
     * @return list<string> danh sách duy nhất (so sánh không phân biệt hoa thường), sắp xếp natcasesort
     */
    public static function uniqueTokens(string $htmlOrText, int $minLength = 2, int $maxLength = 255): array
    {
        $plain = html_entity_decode(strip_tags($htmlOrText), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $plain = preg_replace('/\s+/u', ' ', $plain) ?? '';
        preg_match_all('/[\p{L}\p{M}\p{N}]+(?:[-\'][\p{L}\p{M}\p{N}]+)*/u', $plain, $m);
        $raw = $m[0] ?? [];
        $byLowerKey = [];
        foreach ($raw as $t) {
            $t = trim((string) $t);
            $len = mb_strlen($t);
            if ($len < $minLength || $len > $maxLength) {
                continue;
            }
            if (preg_match('/^\d+$/u', $t) === 1) {
                continue;
            }
            $key = mb_strtolower($t);
            if ($key === '') {
                continue;
            }
            if (! isset($byLowerKey[$key])) {
                $byLowerKey[$key] = $t;
            }
        }
        $list = array_values($byLowerKey);
        natcasesort($list);

        return array_values($list);
    }
}
