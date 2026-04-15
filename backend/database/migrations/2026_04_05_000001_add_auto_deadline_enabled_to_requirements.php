<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            if (!Schema::hasColumn('requirements', 'auto_deadline_enabled')) {
                $table->boolean('auto_deadline_enabled')->default(true)->after('deadline');
            }
        });
    }

    public function down(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            if (Schema::hasColumn('requirements', 'auto_deadline_enabled')) {
                $table->dropColumn('auto_deadline_enabled');
            }
        });
    }
};
