<?php

namespace App\Console\Commands;

use App\Models\Chapter;
use Illuminate\Console\Command;

class SanitizeChapterContent extends Command
{
    protected $signature = 'chapters:sanitize-content
        {--dry-run : Chỉ in kết quả, KHÔNG lưu DB}
        {--id=* : Giới hạn chapter ID cụ thể (lặp lại được); bỏ trống = tất cả chapter có content}';

    protected $description = 'Backfill: làm sạch cột chapters.content cho data cũ (strip markdown bold/italic, normalize smart-quote, bỏ dòng artifact AI biên tập)';

    public function handle(): int
    {
        $ids = array_map('intval', array_filter((array) $this->option('id')));
        $dryRun = (bool) $this->option('dry-run');

        $query = Chapter::query()->select(['id', 'content'])->whereNotNull('content')->where('content', '!=', '');

        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }

        $total = $query->count();
        if ($total === 0) {
            $this->warn('Không có chapter nào phù hợp.');
            return self::SUCCESS;
        }

        $this->line("Quét {$total} chapter...");

        $changed = 0;
        $totalCharDelta = 0;

        // Top-10 thay đổi nhiều nhất (id => delta)
        $topChanged = [];

        // 3 ví dụ before/after ngắn để verify
        $examples = [];

        $query->chunkById(200, function ($chapters) use (
            $dryRun,
            &$changed,
            &$totalCharDelta,
            &$topChanged,
            &$examples,
        ): void {
            foreach ($chapters as $chapter) {
                $old = (string) ($chapter->content ?? '');
                $new = self::sanitize($old);

                if ($new === $old) {
                    continue;
                }

                $delta = mb_strlen($old) - mb_strlen($new);
                $changed++;
                $totalCharDelta += $delta;
                $topChanged[] = ['id' => $chapter->id, 'delta' => $delta];

                // Thu thập tối đa 3 ví dụ
                if (count($examples) < 3) {
                    $examples[] = [
                        'id' => $chapter->id,
                        'before' => $old,
                        'after' => $new,
                    ];
                }

                $asterisksBefore = substr_count($old, '*');
                $asteroidsAfter = substr_count($new, '*');
                $asterisksRemoved = $asterisksBefore - $asteroidsAfter;
                $smartQuotesRemoved = self::countSmartQuotes($old) - self::countSmartQuotes($new);
                $artifactLinesRemoved = self::countArtifactLines($old) - self::countArtifactLines($new);

                $label = $dryRun ? '[dry-run]' : '[update]';
                $this->line(sprintf(
                    '  %s Chapter #%d: len %d→%d (-%d), *×%d, smart-quote×%d, artifact-line×%d',
                    $label,
                    $chapter->id,
                    mb_strlen($old),
                    mb_strlen($new),
                    $delta,
                    $asterisksRemoved,
                    $smartQuotesRemoved,
                    $artifactLinesRemoved,
                ));

                if (! $dryRun) {
                    Chapter::withoutTimestamps(function () use ($chapter, $new): void {
                        $chapter->content = $new;
                        $chapter->saveQuietly();
                    });
                }
            }
        });

        // Sort top-10 theo delta giảm dần
        usort($topChanged, static fn ($a, $b): int => $b['delta'] <=> $a['delta']);
        $topChanged = array_slice($topChanged, 0, 10);

        $this->newLine();
        $this->info('=== Summary ===');
        $this->line("Tổng chapter quét : {$total}");
        $this->line("Chapter sẽ thay đổi: {$changed}");
        $this->line("Tổng ký tự giảm    : {$totalCharDelta}");

        if ($topChanged !== []) {
            $this->newLine();
            $this->info('--- Top 10 chapter thay đổi nhiều nhất ---');
            foreach ($topChanged as $item) {
                $this->line("  Chapter #{$item['id']}: -{$item['delta']} ký tự");
            }
        }

        if ($examples !== []) {
            $this->newLine();
            $this->info('--- 3 ví dụ before/after (đoạn ngắn để verify) ---');
            foreach ($examples as $i => $ex) {
                $num = $i + 1;
                $this->line("  [{$num}] Chapter #{$ex['id']}");
                $this->line('  BEFORE (200 ký tự đầu):');
                $this->comment('    '.mb_substr($ex['before'], 0, 200));
                $this->line('  AFTER  (200 ký tự đầu):');
                $this->comment('    '.mb_substr($ex['after'], 0, 200));
                $this->newLine();
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->comment('[dry-run] Không có gì được lưu vào DB. Chạy lại KHÔNG có --dry-run để apply.');
        }

        return self::SUCCESS;
    }

    // -----------------------------------------------------------------------
    // Sanitize logic — khớp với worker-crawler/crawl_lib.py::_sanitize_chapter_content
    // -----------------------------------------------------------------------

    /**
     * Làm sạch content chương:
     * 1. Strip markdown bold/italic (**...** và *...*) — giữ text bên trong, bỏ ký tự *.
     *    Xử lý ** trước * để tránh nhầm lẫn.
     * 2. Normalize smart/curly quotes → ASCII thẳng: " " → "; ' ' → '.
     *    Không đụng « », —, –.
     * 3. Bỏ dòng artifact AI biên tập: chỉ xoá dòng MỞ ĐẦU bằng pattern
     *    (case-insensitive), tránh xoá nhầm câu truyện có chữ "biên tập" ở giữa.
     */
    private static function sanitize(string $text): string
    {
        if ($text === '') {
            return $text;
        }

        // 1a. Strip markdown bold: **...**
        $text = (string) preg_replace('/\*\*(.+?)\*\*/su', '$1', $text);
        // 1b. Strip markdown italic: *...*
        $text = (string) preg_replace('/\*(.+?)\*/su', '$1', $text);

        // 2. Normalize smart/curly quotes
        $text = str_replace(["\u{201C}", "\u{201D}"], '"', $text); // " " → "
        $text = str_replace(["\u{2018}", "\u{2019}"], "'", $text); // ' ' → '

        // 3. Bỏ dòng artifact AI biên tập (chỉ khi dòng MỞ ĐẦU khớp pattern)
        $lines = explode("\n", $text);
        $cleaned = [];
        foreach ($lines as $line) {
            if (self::isArtifactLine($line)) {
                continue;
            }
            $cleaned[] = $line;
        }
        $text = implode("\n", $cleaned);

        return $text;
    }

    /**
     * Trả true nếu dòng (sau trim) bắt đầu bằng một trong các pattern artifact AI biên tập.
     * Pattern khớp với _EDITORIAL_ARTIFACT_LINE trong crawl_lib.py.
     */
    private static function isArtifactLine(string $line): bool
    {
        $trimmed = trim($line);
        if ($trimmed === '') {
            return false;
        }

        // Bỏ markdown wrapper nếu có (vd. **Văn bản đã biên tập:**) trước khi check
        $stripped = (string) preg_replace('/^\*\*(.+?)\*\*\s*$/', '$1', $trimmed);

        $patterns = [
            '/^Biên\s*tập\s*lại\s*:/iu',
            '/^Văn\s*bản\s*đã\s*biên\s*tập\s*:/iu',
            '/^Dưới\s*đây\s*là\s*văn\s*bản\s*đã\s*(được\s*)?biên\s*tập(\s*lại)?\s*:/iu',
            '/^Được\s*rồi,?\s*hãy\s*bắt\s*đầu\s*biên\s*tập/iu',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $trimmed) || preg_match($pattern, $stripped)) {
                return true;
            }
        }

        return false;
    }

    // -----------------------------------------------------------------------
    // Metric helpers — dùng để in thống kê per-chapter
    // -----------------------------------------------------------------------

    /** Đếm số smart/curly quote trong text (để tính số được normalize). */
    private static function countSmartQuotes(string $text): int
    {
        $count = 0;
        foreach (["\u{201C}", "\u{201D}", "\u{2018}", "\u{2019}"] as $q) {
            $count += mb_substr_count($text, $q);
        }
        return $count;
    }

    /** Đếm số dòng artifact trong text (để tính số bị xoá). */
    private static function countArtifactLines(string $text): int
    {
        $count = 0;
        foreach (explode("\n", $text) as $line) {
            if (self::isArtifactLine($line)) {
                $count++;
            }
        }
        return $count;
    }
}
