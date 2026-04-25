<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('voice_id');
            $table->float('pitch')->default(1.0);
            $table->float('rate')->default(1.0);
            $table->timestamps();

            $table->unique(['story_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('characters');
    }
};
