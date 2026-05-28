<?php

namespace App\Console\Commands;

use App\Models\Chapter;
use Illuminate\Console\Command;

class RecomputeChapterSpeakerQuality extends Command
{
    protected $signature = 'chapters:recompute-speaker-quality
        {--id=* : Chapter ID cụ thể (lặp lại được, bỏ trống = tất cả chapter có content_segments)}
        {--threshold=80 : Ngưỡng % cảnh báo low-quality}
        {--dry-run : Chỉ in kết quả, không lưu DB}';

    protected $description = 'Tính/ghi cột speaker_quality: % ký tự thoại (non-narration) được gán speaker hợp lệ (không phải _unknown). Chương toàn narration => NULL (N/A).';

    /** Speaker coi là narration (không tính vào thoại). */
    private const NARRATION_SPEAKERS = ['narration', 'narrator', 'người dẫn', 'dẫn truyện'];

    /** Speaker coi là gán THẤT BẠI (thoại nhưng không xác định được người nói). */
    private const UNKNOWN_SPEAKERS = ['_unknown', 'unknown', '?', 'unknown_speaker'];

    public function handle(): int
    {
        $ids = array_map('intval', array_filter((array) $this->option('id')));
        $dryRun = (bool) $this->option('dry-run');
        $threshold = (float) $this->option('threshold');

        $query = Chapter::query()->select(['id', 'content_segments']);

        if ($ids !== []) {
            $query->whereIn('id', $ids);
        } else {
            $query->whereNotNull('content_segments')
                ->where('content_segments', '!=', '[]')
                ->where('content_segments', '!=', 'null');
        }

        $chapters = $query->get();

        if ($chapters->isEmpty()) {
            $this->warn('Không có chapter nào phù hợp.');

            return self::SUCCESS;
        }

        $updated = 0;
        $skipped = 0;          // không có thoại (toàn narration) => N/A
        $qualities = [];
        $lowQuality = [];      // < threshold
        $perfect = 0;          // 100%

        foreach ($chapters as $chapter) {
            $segments = $chapter->content_segments;
            if (! is_array($segments) || count($segments) === 0) {
                $skipped++;

                continue;
            }

            $dialogueNw = 0;     // tổng ký tự các segment thoại
            $attributedNw = 0;   // ký tự thoại có speaker hợp lệ
            $unknownNw = 0;      // ký tự thoại bị _unknown

            foreach ($segments as $seg) {
                if (! is_array($seg)) {
                    continue;
                }

                $text = (string) ($seg['text'] ?? '');
                $nw = mb_strlen(preg_replace('/\s+/u', '', $text));
                if ($nw === 0) {
                    continue;
                }

                $type = mb_strtolower(trim((string) ($seg['type'] ?? '')));
                $speakerRaw = $seg['speaker'] ?? null;
                $speaker = trim((string) $speakerRaw);
                $speakerLower = mb_strtolower($speaker);

                $isNarration = $type === 'narrative'
                    || in_array($speakerLower, self::NARRATION_SPEAKERS, true)
                    || ($speaker === '' && $type !== 'dialogue');

                if ($isNarration) {
                    continue; // narration không tính vào chất lượng gán speaker
                }

                $dialogueNw += $nw;

                $isUnknown = $speaker === '' || in_array($speakerLower, self::UNKNOWN_SPEAKERS, true);
                if ($isUnknown) {
                    $unknownNw += $nw;
                } else {
                    $attributedNw += $nw;
                }
            }

            if ($dialogueNw === 0) {
                // Toàn narration: không có gì để gán => N/A
                $this->line("  [n/a]  Chapter #{$chapter->id}: không có thoại");
                if (! $dryRun) {
                    Chapter::withoutTimestamps(function () use ($chapter): void {
                        $chapter->speaker_quality = null;
                        $chapter->saveQuietly();
                    });
                }
                $skipped++;

                continue;
            }

            $quality = round(100 * $attributedNw / $dialogueNw, 2);
            $qualities[] = $quality;

            $label = $dryRun ? '[dry-run]' : '[update]';
            $this->line("  {$label} Chapter #{$chapter->id}: dialogue_nw={$dialogueNw}, attributed={$attributedNw}, unknown={$unknownNw}, quality={$quality}%");

            if (! $dryRun) {
                Chapter::withoutTimestamps(function () use ($chapter, $quality): void {
                    $chapter->speaker_quality = $quality;
                    $chapter->saveQuietly();
                });
            }

            $updated++;

            if ($quality >= 100) {
                $perfect++;
            }
            if ($quality < $threshold) {
                $lowQuality[] = ['id' => $chapter->id, 'quality' => $quality, 'unknown_nw' => $unknownNw];
            }
        }

        $this->newLine();
        $this->info('=== Summary ===');
        $this->line("Chapters có thoại (đã tính): {$updated}");
        $this->line("Chapters N/A (toàn narration): {$skipped}");

        if (count($qualities) > 0) {
            $min = min($qualities);
            $max = max($qualities);
            $avg = round(array_sum($qualities) / count($qualities), 2);
            $this->line("Min quality : {$min}%");
            $this->line("Max quality : {$max}%");
            $this->line("Avg quality : {$avg}%");
            $this->line("Đạt 100%    : {$perfect}");
        }

        if (count($lowQuality) > 0) {
            usort($lowQuality, static fn ($a, $b) => $a['quality'] <=> $b['quality']);
            $this->warn("--- Low speaker-quality (< {$threshold}%) ---");
            foreach ($lowQuality as $item) {
                $this->warn("  Chapter #{$item['id']}: {$item['quality']}% (unknown_nw={$item['unknown_nw']})");
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->comment('[dry-run] Không có gì được lưu vào DB.');
        }

        return self::SUCCESS;
    }
}
