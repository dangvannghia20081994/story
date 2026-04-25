<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lexicons', function (Blueprint $table) {
            $table->id();
            $table->string('word');
            $table->string('replacement');
            $table->string('type', 32)->default('pronunciation');
            $table->integer('priority')->default(0);
            $table->timestamps();

            $table->index(['priority', 'word']);
            $table->unique(['word', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lexicons');
    }
};
