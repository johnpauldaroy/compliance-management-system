<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration {
    public function up(): void
    {
        // 1. Create requirement_assignments table
        if (!Schema::hasTable('requirement_assignments')) {
            Schema::create('requirement_assignments', function (Blueprint $table) {
                $table->id();
                $table->string('assignment_id')->unique();
                $table->foreignId('requirement_id')->constrained('requirements')->onDelete('cascade');
                $table->foreignId('assigned_to_user_id')->constrained('users')->onDelete('cascade');
                $table->date('deadline')->nullable();
                $table->enum('compliance_status', ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'OVERDUE'])->default('PENDING');
                $table->timestamp('last_submitted_at')->nullable();
                $table->timestamp('last_approved_at')->nullable();
                $table->timestamps();

                $table->unique(['requirement_id', 'assigned_to_user_id'], 'req_assignments_req_user_uniq');
            });
        }

        // 2. Data Migration: Create assignments from requirements table
        $requirements = DB::table('requirements')->get();
        foreach ($requirements as $req) {
            $picIds = array_filter(array_map('intval', explode(';', $req->person_in_charge_user_ids ?? '')));
            foreach ($picIds as $userId) {
                // Check if assignment already exists (just in case)
                $exists = DB::table('requirement_assignments')
                    ->where('requirement_id', $req->id)
                    ->where('assigned_to_user_id', $userId)
                    ->exists();

                if (!$exists) {
                    DB::table('requirement_assignments')->insert([
                        'assignment_id' => 'ASGN-' . strtoupper(Str::random(10)),
                        'requirement_id' => $req->id,
                        'assigned_to_user_id' => $userId,
                        'deadline' => $req->deadline,
                        'compliance_status' => 'PENDING', // Will be updated by uploads mapping
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }

        // 3. Update uploads table: Add assignment_id
        if (Schema::hasTable('uploads')) {
            Schema::table('uploads', function (Blueprint $table) {
                if (!Schema::hasColumn('uploads', 'assignment_id')) {
                    $table->foreignId('assignment_id')->nullable()->after('requirement_id')->constrained('requirement_assignments')->onDelete('cascade');
                }
            });

            // 4. Map existing uploads to assignments
            $uploads = DB::table('uploads')->get();
            foreach ($uploads as $upload) {
                $assignment = DB::table('requirement_assignments')
                    ->where('requirement_id', $upload->requirement_id)
                    ->where('assigned_to_user_id', $upload->uploaded_by_user_id)
                    ->first();

                if ($assignment) {
                    DB::table('uploads')->where('id', $upload->id)->update([
                        'assignment_id' => $assignment->id,
                    ]);

                    // Update assignment status based on upload
                    $status = 'SUBMITTED';
                    if ($upload->approval_status === 'APPROVED')
                        $status = 'APPROVED';
                    if ($upload->approval_status === 'REJECTED')
                        $status = 'REJECTED';

                    DB::table('requirement_assignments')->where('id', $assignment->id)->update([
                        'compliance_status' => $status,
                        'last_submitted_at' => $upload->upload_date,
                        'last_approved_at' => $upload->approval_status === 'APPROVED' ? $upload->status_change_on : null,
                    ]);
                }
            }
        }

        // 5. Cleanup requirements table (Optional: could keep for history but prompt says "NO COMPLIANCE STATE" in requirements)
        Schema::table('requirements', function (Blueprint $table) {
            // We'll keep them for now to avoid breaking existing code before refactoring
            // $table->dropColumn(['position_ids', 'branch_unit_department_ids', 'person_in_charge_user_ids', 'deadline', 'compliance_status']);
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('uploads')) {
            Schema::table('uploads', function (Blueprint $table) {
                $table->dropForeign(['assignment_id']);
                $table->dropColumn('assignment_id');
            });
        }
        Schema::dropIfExists('requirement_assignments');
    }
};
