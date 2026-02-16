<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            $table->string('assigned_to')->nullable()->after('description');
            $table->string('branch_unit_department_in_charge')->nullable()->after('assigned_to');
            $table->string('person_in_charge')->nullable()->after('branch_unit_department_in_charge');
            $table->date('deadline')->nullable()->after('schedule');
            $table->string('compliance_status')->nullable()->after('deadline');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            $table->dropColumn([
                'assigned_to',
                'branch_unit_department_in_charge',
                'person_in_charge',
                'deadline',
                'compliance_status',
            ]);
        });
    }
};
