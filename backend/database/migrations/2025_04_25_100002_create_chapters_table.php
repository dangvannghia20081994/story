<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chapters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('slug', 191);
            $table->unsignedInteger('chapter_number')->nullable();
            $table->longText('content');
            $table->jsonb('content_segments')->nullable();
            $table->string('audio_path')->nullable();
            $table->unsignedInteger('duration')->default(0);
            $table->index(['story_id', 'chapter_number', 'updated_at']);
            $table->unique(['story_id', 'slug']);
            $table->timestamp('tts_enqueued_at')->nullable();
            $table->timestamp('analyzed_at')->nullable();
            $table->index(['analyzed_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chapters');
    }
};
