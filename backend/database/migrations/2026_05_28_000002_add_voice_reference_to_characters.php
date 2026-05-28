<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->string('voice_reference_path', 255)->nullable()->after('voice_preset')
                ->comment('Relative path từ storage/app/private/, vd "voices/{character_id}.wav". Worker-tts đọc qua bind-mount /app/voices/.');
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table): void {
            $table->dropColumn('voice_reference_path');
        });
    }
};
