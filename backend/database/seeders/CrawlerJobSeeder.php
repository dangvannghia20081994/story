<?php

namespace Database\Seeders;

use App\Models\CrawlerJob;
use App\Models\Story;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CrawlerJobSeeder extends Seeder
{
    /**
     * Bản ghi mẫu crawler_jobs (tvtruyen) — cần đã có story id=1.
     */
    public function run(): void
    {
        if (! Story::query()->whereKey(1)->exists()) {
            $this->command?->warn('CrawlerJobSeeder: bỏ qua — chưa có bản ghi stories.id = 1.');

            return;
        }

        CrawlerJob::query()->updateOrInsert(
            ['id' => 1],
            [
                'story_id' => 1,
                'new_story_title' => 'Đô Thị Tu Tiên Mười Năm Xuống Núi Tức Vô Địch',
                'source_url' => 'https://www.tvtruyen.co.uk/do-thi-tu-tien-muoi-nam-xuong-nui-tuc-vo-dich.html',
                'chapter_links_selector' => 'ul.list-chapter li a',
                'chapter_list_next_page_selector' => '',
                'chapter_title_selector' => 'ul.list-chapter a',
                'chapter_content_selector' => '#chapter-content',
                'max_chapters' => null,
                'chapter_start' => 1,
                'delay_seconds' => 1.0,
                'chapter_fetch_concurrency' => 3,
                'status' => CrawlerJob::STATUS_COMPLETED,
                'chapters_imported' => 100,
                'last_error' => null,
                'created_at' => '2026-04-27 06:57:04',
                'updated_at' => '2026-04-27 07:21:47',
            ],
        );

        if (DB::connection()->getDriverName() === 'pgsql') {
            $max = (int) CrawlerJob::query()->max('id');
            DB::statement(
                'SELECT setval(pg_get_serial_sequence(\'crawler_jobs\', \'id\'), ?, true)',
                [$max > 0 ? $max : 1],
            );
        }
    }
}
