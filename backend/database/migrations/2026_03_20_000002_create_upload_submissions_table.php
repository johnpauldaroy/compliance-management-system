<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('upload_submissions')) {
            Schema::create('upload_submissions', function (Blueprint $table) {
                $table->id();
                $table->string('submission_id')->unique();
                $table->foreignId('requirement_id')->constrained('requirements')->onDelete('cascade');
                $table->foreignId('assignment_id')->nullable()->constrained('requirement_assignments')->onDelete('cascade');
                $table->foreignId('uploaded_by_user_id')->constrained('users')->onDelete('cascade');
                $table->string('uploader_email');
                $table->timestamp('upload_date');
                $table->date('deadline_at_upload')->nullable();
                $table->text('comments')->nullable();
                $table->enum('approval_status', ['PENDING', 'APPROVED', 'REJECTED'])->default('PENDING');
                $table->timestamp('status_change_on')->nullable();
                $table->text('admin_remarks')->nullable();
                $table->integer('upload_year');
                $table->timestamps();
            });
        }

        if (Schema::hasTable('uploads')) {
            Schema::table('uploads', function (Blueprint $table) {
                if (!Schema::hasColumn('uploads', 'submission_id')) {
                    $table->foreignId('submission_id')->nullable()->after('id')->constrained('upload_submissions')->onDelete('cascade');
                }
            });
        }

        if (Schema::hasTable('uploads')) {
            $uploads = DB::table('uploads')->get();
            foreach ($uploads as $upload) {
                $submissionId = DB::table('upload_submissions')->insertGetId([
                    'submission_id' => 'SUB-' . uniqid(),
                    'requirement_id' => $upload->requirement_id,
                    'assignment_id' => $upload->assignment_id,
                    'uploaded_by_user_id' => $upload->uploaded_by_user_id,
                    'uploader_email' => $upload->uploader_email,
                    'upload_date' => $upload->upload_date,
                    'deadline_at_upload' => $upload->deadline_at_upload,
                    'comments' => $upload->comments,
                    'approval_status' => $upload->approval_status ?? 'PENDING',
                    'status_change_on' => $upload->status_change_on,
                    'admin_remarks' => $upload->admin_remarks,
                    'upload_year' => $upload->upload_year ?? (int) date('Y'),
                    'created_at' => $upload->created_at ?? now(),
                    'updated_at' => $upload->updated_at ?? now(),
                ]);

                DB::table('uploads')
                    ->where('id', $upload->id)
                    ->update(['submission_id' => $submissionId]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('uploads')) {
            Schema::table('uploads', function (Blueprint $table) {
                if (Schema::hasColumn('uploads', 'submission_id')) {
                    $table->dropForeign(['submission_id']);
                    $table->dropColumn('submission_id');
                }
            });
        }

        Schema::dropIfExists('upload_submissions');
    }
};
