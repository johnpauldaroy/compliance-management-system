<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('uploads')) {
            return;
        }

        Schema::table('uploads', function (Blueprint $table) {
            if (!Schema::hasColumn('uploads', 'deadline_at_upload')) {
                $table->date('deadline_at_upload')->nullable()->after('upload_date');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('uploads')) {
            return;
        }

        Schema::table('uploads', function (Blueprint $table) {
            if (Schema::hasColumn('uploads', 'deadline_at_upload')) {
                $table->dropColumn('deadline_at_upload');
            }
        });
    }
};
