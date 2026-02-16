<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
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

    public function down(): void
    {
        Schema::dropIfExists('requirement_assignments');
    }
};
