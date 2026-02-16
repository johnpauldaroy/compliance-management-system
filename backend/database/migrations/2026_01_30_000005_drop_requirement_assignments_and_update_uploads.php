<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('uploads')) {
            Schema::table('uploads', function (Blueprint $table) {
                if (Schema::hasColumn('uploads', 'assignment_id')) {
                    $table->dropForeign(['assignment_id']);
                    $table->dropColumn('assignment_id');
                }
            });

            Schema::table('uploads', function (Blueprint $table) {
                if (!Schema::hasColumn('uploads', 'requirement_id')) {
                    $table->foreignId('requirement_id')
                        ->after('upload_id')
                        ->constrained('requirements')
                        ->onDelete('cascade');
                }
            });
        }

        if (Schema::hasTable('requirement_assignments')) {
            Schema::drop('requirement_assignments');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('requirement_assignments')) {
            Schema::create('requirement_assignments', function (Blueprint $table) {
                $table->id();
                $table->string('assignment_id')->unique();
                $table->foreignId('requirement_id')->constrained('requirements')->onDelete('cascade');
                $table->foreignId('assigned_to_user_id')->constrained('users')->onDelete('cascade');
                $table->date('deadline');
                $table->enum('compliance_status', ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'OVERDUE'])->default('PENDING');
                $table->timestamp('last_submitted_at')->nullable();
                $table->timestamp('last_approved_at')->nullable();
                $table->timestamps();

                $table->unique(['requirement_id', 'assigned_to_user_id'], 'req_assignments_req_user_uniq');
            });
        }

        if (Schema::hasTable('uploads')) {
            Schema::table('uploads', function (Blueprint $table) {
                if (Schema::hasColumn('uploads', 'requirement_id')) {
                    $table->dropForeign(['requirement_id']);
                    $table->dropColumn('requirement_id');
                }
            });

            Schema::table('uploads', function (Blueprint $table) {
                if (!Schema::hasColumn('uploads', 'assignment_id')) {
                    $table->foreignId('assignment_id')
                        ->after('upload_id')
                        ->constrained('requirement_assignments')
                        ->onDelete('cascade');
                }
            });
        }
    }
};
