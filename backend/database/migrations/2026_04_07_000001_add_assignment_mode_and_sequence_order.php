<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            if (!Schema::hasColumn('requirements', 'assignment_mode')) {
                $table->string('assignment_mode', 20)->default('parallel')->after('auto_deadline_enabled');
            }
        });

        Schema::table('requirement_assignments', function (Blueprint $table) {
            if (!Schema::hasColumn('requirement_assignments', 'sequence_order')) {
                $table->unsignedInteger('sequence_order')->nullable()->after('assigned_to_user_id');
                $table->index(['requirement_id', 'sequence_order'], 'req_assignments_sequence_idx');
                $table->unique(['requirement_id', 'sequence_order'], 'req_assignments_sequence_uniq');
            }
        });
    }

    public function down(): void
    {
        Schema::table('requirement_assignments', function (Blueprint $table) {
            if (Schema::hasColumn('requirement_assignments', 'sequence_order')) {
                $table->dropUnique('req_assignments_sequence_uniq');
                $table->dropIndex('req_assignments_sequence_idx');
                $table->dropColumn('sequence_order');
            }
        });

        Schema::table('requirements', function (Blueprint $table) {
            if (Schema::hasColumn('requirements', 'assignment_mode')) {
                $table->dropColumn('assignment_mode');
            }
        });
    }
};
