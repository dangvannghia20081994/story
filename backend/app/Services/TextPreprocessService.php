<?php

namespace App\Services;

use App\Models\Lexicon;

class TextPreprocessService
{
    /**
     * Áp dụng lexicon theo priority giảm dần, cùng priority thì từ dài xử lý trước (tránh thay thế ngắn làm hỏng match dài).
     */
    public function apply(string $text): string
    {
        $rules = Lexicon::query()
            ->orderByDesc('priority')
            ->orderByRaw('length(word) DESC')
            ->get(['word', 'replacement']);

        $out = $text;
        foreach ($rules as $rule) {
            $word = $rule->word;
            if ($word === '') {
                continue;
            }
            $out = $this->replaceAllInsensitive($out, $word, $rule->replacement);
        }

        return $out;
    }

    private function replaceAllInsensitive(string $haystack, string $needle, string $replace): string
    {
        if ($needle === '') {
            return $haystack;
        }

        return preg_replace('/'.preg_quote($needle, '/').'/iu', $replace, $haystack) ?? $haystack;
    }
}
