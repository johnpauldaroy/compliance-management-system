<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('requirement_assignments', function (Blueprint $table) {
            if (!Schema::hasColumn('requirement_assignments', 'removed_at')) {
                $table->timestamp('removed_at')->nullable()->after('last_approved_at');
            }

            if (!Schema::hasColumn('requirement_assignments', 'removed_by_user_id')) {
                $table->foreignId('removed_by_user_id')
                    ->nullable()
                    ->after('removed_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('requirement_assignments', function (Blueprint $table) {
            if (Schema::hasColumn('requirement_assignments', 'removed_by_user_id')) {
                $table->dropForeign(['removed_by_user_id']);
                $table->dropColumn('removed_by_user_id');
            }

            if (Schema::hasColumn('requirement_assignments', 'removed_at')) {
                $table->dropColumn('removed_at');
            }
        });
    }
};
