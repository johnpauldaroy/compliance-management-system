<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('requirements', function (Blueprint $table) {
            $table->id();
            $table->string('req_id')->unique();
            $table->foreignId('agency_id')->constrained('agencies')->onDelete('cascade');
            $table->string('category');
            $table->string('requirement');
            $table->text('description')->nullable();
            $table->string('frequency');
            $table->string('schedule');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('requirements');
    }
};
