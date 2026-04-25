<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dictionary_entries', function (Blueprint $table) {
            $table->id();
            $table->string('word');
            $table->string('ipa')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique('word');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dictionary_entries');
    }
};
