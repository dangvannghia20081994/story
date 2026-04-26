<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stories', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->nullable()->unique();
            $table->text('description')->nullable();
            $table->string('genre', 64)->nullable();
            $table->string('serial_status', 32)->default('ongoing');
            $table->timestamps();

            $table->index('genre');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stories');
    }
};
