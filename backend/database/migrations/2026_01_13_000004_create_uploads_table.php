<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('uploads', function (Blueprint $table) {
            $table->id();
            $table->string('upload_id')->unique();
            $table->foreignId('assignment_id')->constrained('requirement_assignments')->onDelete('cascade');
            $table->string('doc_file');
            $table->foreignId('uploaded_by_user_id')->constrained('users')->onDelete('cascade');
            $table->string('uploader_email');
            $table->timestamp('upload_date');
            $table->text('comments')->nullable();
            $table->enum('approval_status', ['PENDING', 'APPROVED', 'REJECTED'])->default('PENDING');
            $table->timestamp('status_change_on')->nullable();
            $table->text('admin_remarks')->nullable();
            $table->integer('upload_year');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uploads');
    }
};
