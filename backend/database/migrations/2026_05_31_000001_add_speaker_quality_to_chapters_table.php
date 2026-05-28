<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chapters', function (Blueprint $table) {
            // % ký tự thoại (non-narration) được gán speaker hợp lệ (không phải _unknown/Unknown).
            // NULL = chưa tính, hoặc chương không có thoại (toàn narration). Đặt cạnh coverage.
            $table->decimal('speaker_quality', 6, 2)->nullable()->after('coverage');
        });
    }

    public function down(): void
    {
        Schema::table('chapters', function (Blueprint $table) {
            $table->dropColumn('speaker_quality');
        });
    }
};
