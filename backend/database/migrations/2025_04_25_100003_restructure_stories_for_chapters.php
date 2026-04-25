<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('title');
            $table->text('description')->nullable()->after('slug');
        });

        foreach (DB::table('stories')->select(['id', 'title'])->get() as $s) {
            $base = Str::slug($s->title) ?: 'story';
            DB::table('stories')->where('id', $s->id)->update([
                'slug' => $base.'-'.$s->id,
            ]);
        }

        $rows = DB::table('stories')->select(['id', 'title', 'content', 'audio_path', 'tts_status', 'tts_error', 'created_at', 'updated_at'])->get();

        foreach ($rows as $row) {
            $status = match ($row->tts_status) {
                'ready' => 'completed',
                'processing' => 'processing',
                'failed' => 'failed',
                default => 'pending',
            };

            DB::table('chapters')->insert([
                'story_id' => $row->id,
                'title' => 'Chương 1',
                'content' => $row->content,
                'audio_path' => $row->audio_path,
                'status' => $status,
                'duration' => 0,
                'error_message' => $row->tts_error,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
            ]);
        }

        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn(['content', 'audio_path', 'tts_status', 'tts_error']);
        });

        Schema::table('stories', function (Blueprint $table) {
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('stories', function (Blueprint $table) {
            $table->dropUnique(['slug']);
        });

        Schema::table('stories', function (Blueprint $table) {
            $table->text('content')->nullable();
            $table->string('audio_path')->nullable();
            $table->string('tts_status', 32)->default('pending');
            $table->text('tts_error')->nullable();
        });

        foreach (DB::table('chapters')->orderBy('id')->get() as $chapter) {
            DB::table('stories')->where('id', $chapter->story_id)->update([
                'content' => $chapter->content,
                'audio_path' => $chapter->audio_path,
                'tts_status' => match ($chapter->status) {
                    'completed' => 'ready',
                    'processing' => 'processing',
                    'failed' => 'failed',
                    default => 'pending',
                },
                'tts_error' => $chapter->error_message,
                'updated_at' => $chapter->updated_at,
            ]);
        }

        DB::table('chapters')->truncate();

        Schema::table('stories', function (Blueprint $table) {
            $table->dropColumn(['slug', 'description']);
        });
    }
};
