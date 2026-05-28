<?php

namespace App\Console\Commands;

use App\Models\Chapter;
use Illuminate\Console\Command;

class RecomputeChapterCoverage extends Command
{
    protected $signature = 'chapters:recompute-coverage
        {--id=* : Chapter ID cụ thể (lặp lại được, bỏ trống = tất cả chapter đã analyze)}
        {--dry-run : Chỉ in kết quả, không lưu DB}';

    protected $description = 'Tính/ghi lại cột coverage cho chapters theo metric no-whitespace (seg_nw / content_nw * 100)';

    public function handle(): int
    {
        $ids = array_map('intval', array_filter((array) $this->option('id')));
        $dryRun = (bool) $this->option('dry-run');

        $query = Chapter::query()->select(['id', 'content', 'content_segments', 'analyzed_at']);

        if ($ids !== []) {
            $query->whereIn('id', $ids);
        } else {
            // Chỉ tính chapter đã analyze và có content_segments
            $query->whereNotNull('analyzed_at')
                ->whereNotNull('content_segments')
                ->where('content_segments', '!=', '[]')
                ->where('content_segments', '!=', 'null');
        }

        $chapters = $query->get();

        if ($chapters->isEmpty()) {
            $this->warn('Không có chapter nào phù hợp.');
            return self::SUCCESS;
        }

        $updated = 0;
        $skipped = 0;
        $coverages = [];
        $underCoverage = [];   // < 85
        $overCoverage = [];    // > 105

        foreach ($chapters as $chapter) {
            $content = (string) ($chapter->content ?? '');
            $contentNw = mb_strlen(preg_replace('/\s+/u', '', $content));

            if ($contentNw === 0) {
                $this->line("  [skip] Chapter #{$chapter->id}: content_nw = 0");
                $skipped++;
                continue;
            }

            $segments = $chapter->content_segments;
            if (! is_array($segments) || count($segments) === 0) {
                $this->line("  [skip] Chapter #{$chapter->id}: content_segments rỗng");
                $skipped++;
                continue;
            }

            $segNw = 0;
            foreach ($segments as $seg) {
                $text = '';
                if (is_string($seg)) {
                    $text = $seg;
                } elseif (is_array($seg) && isset($seg['text'])) {
                    $text = (string) $seg['text'];
                } elseif (is_object($seg) && isset($seg->text)) {
                    $text = (string) $seg->text;
                }
                $segNw += mb_strlen(preg_replace('/\s+/u', '', $text));
            }

            $coverage = round(100 * $segNw / $contentNw, 2);
            $coverages[] = $coverage;

            $label = $dryRun ? '[dry-run]' : '[update]';
            $this->line("  {$label} Chapter #{$chapter->id}: content_nw={$contentNw}, seg_nw={$segNw}, coverage={$coverage}%");

            if (! $dryRun) {
                Chapter::withoutTimestamps(function () use ($chapter, $coverage): void {
                    $chapter->coverage = $coverage;
                    $chapter->saveQuietly();
                });
            }

            $updated++;

            if ($coverage < 85) {
                $underCoverage[] = ['id' => $chapter->id, 'coverage' => $coverage];
            } elseif ($coverage > 105) {
                $overCoverage[] = ['id' => $chapter->id, 'coverage' => $coverage];
            }
        }

        $this->newLine();
        $this->info('=== Summary ===');
        $this->line("Chapters xử lý : {$updated}");
        $this->line("Chapters bỏ qua: {$skipped}");

        if (count($coverages) > 0) {
            $min = min($coverages);
            $max = max($coverages);
            $avg = round(array_sum($coverages) / count($coverages), 2);
            $this->line("Min coverage   : {$min}%");
            $this->line("Max coverage   : {$max}%");
            $this->line("Avg coverage   : {$avg}%");
        }

        if (count($underCoverage) > 0) {
            $this->warn('--- Under-coverage (< 85%) ---');
            foreach ($underCoverage as $item) {
                $this->warn("  Chapter #{$item['id']}: {$item['coverage']}%");
            }
        }

        if (count($overCoverage) > 0) {
            $this->warn('--- Over-coverage (> 105%) ---');
            foreach ($overCoverage as $item) {
                $this->warn("  Chapter #{$item['id']}: {$item['coverage']}%");
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->comment('[dry-run] Không có gì được lưu vào DB.');
        }

        return self::SUCCESS;
    }
}
