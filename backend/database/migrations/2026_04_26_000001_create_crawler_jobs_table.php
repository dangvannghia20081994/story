<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('crawler_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('story_id')->nullable()->constrained('stories')->nullOnDelete();
            $table->string('new_story_title')->nullable();
            $table->string('story_title_selector', 2000)->nullable();
            $table->text('source_url');
            $table->string('chapter_links_selector')->default('');
            $table->string('chapter_list_next_page_selector')->default('');
            $table->string('chapter_title_selector');
            $table->string('chapter_content_selector');
            $table->unsignedInteger('max_chapters')->nullable();
            $table->unsignedInteger('chapter_start')->default(1);
            $table->decimal('delay_seconds', 5, 2)->default(1.5);
            $table->unsignedTinyInteger('chapter_fetch_concurrency')->nullable();
            $table->string('status', 32)->default('pending');
            $table->unsignedInteger('chapters_imported')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crawler_jobs');
    }
};
