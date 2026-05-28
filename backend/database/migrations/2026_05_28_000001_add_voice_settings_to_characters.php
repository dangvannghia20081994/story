<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->string('voice_preset', 50)->nullable()->after('name')
                ->comment('Key preset VieNeu (Binh, Tuyen, Vinh, Doan, Ly, Son, Ngoc). NULL = fallback default.');
            $table->smallInteger('pitch_semitones')->default(0)->after('voice_preset');
            $table->decimal('tempo_factor', 3, 2)->default(1.0)->after('pitch_semitones');
            $table->boolean('is_system')->default(false)->after('tempo_factor')
                ->comment('true = pseudo-character "narration" / "_unknown" auto-create theo story; CMS ẩn khi list nhân vật thực.');
            $table->index('is_system');
        });

        // Backfill: với mọi story đang có, insert 2 system character narration + _unknown.
        $storyIds = DB::table('stories')->pluck('id');
        $now = now();
        foreach ($storyIds as $storyId) {
            foreach (['narration', '_unknown'] as $name) {
                DB::table('characters')->updateOrInsert(
                    ['story_id' => $storyId, 'name' => $name],
                    [
                        'is_system' => true,
                        'voice_preset' => null,
                        'pitch_semitones' => 0,
                        'tempo_factor' => 1.0,
                        'updated_at' => $now,
                        'created_at' => $now,
                    ],
                );
            }
        }
    }

    public function down(): void
    {
        DB::table('characters')->where('is_system', true)
            ->whereIn('name', ['narration', '_unknown'])
            ->delete();

        Schema::table('characters', function (Blueprint $table): void {
            $table->dropIndex(['is_system']);
            $table->dropColumn(['voice_preset', 'pitch_semitones', 'tempo_factor', 'is_system']);
        });
    }
};
