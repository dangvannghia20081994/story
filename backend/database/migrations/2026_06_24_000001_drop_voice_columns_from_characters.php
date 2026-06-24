<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Gỡ cấu hình voice per-character (di sản pipeline TTS đa giọng đã loại bỏ).
     * Giữ lại is_system (vẫn dùng để đánh dấu nhân vật narration/_unknown).
     */
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->dropColumn(['voice_preset', 'voice_reference_path', 'pitch_semitones', 'tempo_factor']);
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->string('voice_preset', 50)->nullable()->after('name');
            $table->string('voice_reference_path', 255)->nullable()->after('voice_preset');
            $table->smallInteger('pitch_semitones')->default(0)->after('voice_reference_path');
            $table->decimal('tempo_factor', 3, 2)->default(1.0)->after('pitch_semitones');
        });
    }
};
