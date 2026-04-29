<?php

namespace App\Services;

use App\Models\Lexicon;
use Illuminate\Database\Eloquent\Collection;

/**
 * Áp bảng lexicon lên plain text (TTS / đồng bộ với logic replace phía frontend).
 */
final class LexiconTextService
{
    /**
     * @param  Collection<int, Lexicon>|null  $lexicons  null = lấy từ {@see LexiconCacheService::allOrdered()}
     */
    public function applyToPlainText(string $plain, ?Collection $lexicons = null): string
    {
        $plain = trim($plain);
        if ($plain === '') {
            return '';
        }

        $rows = $lexicons ?? app(LexiconCacheService::class)->allOrdered();
        if ($rows->isEmpty()) {
            return $plain;
        }

        $sorted = $rows->sort(function (Lexicon $a, Lexicon $b): int {
            if ($a->priority !== $b->priority) {
                return $b->priority <=> $a->priority;
            }

            return mb_strlen($b->word) <=> mb_strlen($a->word);
        })->values();

        foreach ($sorted as $row) {
            $w = $row->word;
            if ($w === '') {
                continue;
            }
            $rep = (string) ($row->replacement ?? '');
            if ($row->type === Lexicon::TYPE_FILTER && $rep === '') {
                $rep = '';
            }

            $pattern = '/'.preg_quote($w, '/').'/iu';
            $plain = preg_replace_callback(
                $pattern,
                static fn (): string => $rep,
                $plain
            ) ?? $plain;
        }

        $plain = preg_replace('/\s+/u', ' ', $plain) ?? $plain;

        return trim($plain);
    }
}
