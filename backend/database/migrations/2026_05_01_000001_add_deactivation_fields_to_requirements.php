<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            if (!Schema::hasColumn('requirements', 'deactivated_at')) {
                $table->timestamp('deactivated_at')->nullable()->after('assignment_mode');
            }

            if (!Schema::hasColumn('requirements', 'deactivated_by_user_id')) {
                $table->foreignId('deactivated_by_user_id')
                    ->nullable()
                    ->after('deactivated_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            if (Schema::hasColumn('requirements', 'deactivated_by_user_id')) {
                $table->dropForeign(['deactivated_by_user_id']);
                $table->dropColumn('deactivated_by_user_id');
            }

            if (Schema::hasColumn('requirements', 'deactivated_at')) {
                $table->dropColumn('deactivated_at');
            }
        });
    }
};
