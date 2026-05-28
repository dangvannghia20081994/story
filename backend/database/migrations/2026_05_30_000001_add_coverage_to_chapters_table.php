<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chapters', function (Blueprint $table) {
            // % độ phủ content_segments so với content (metric no-whitespace).
            // NULL = chưa tính. Đặt sau analyzed_at để nhóm logic phân tích gần nhau.
            $table->decimal('coverage', 6, 2)->nullable()->after('analyzed_at');
        });
    }

    public function down(): void
    {
        Schema::table('chapters', function (Blueprint $table) {
            $table->dropColumn('coverage');
        });
    }
};
