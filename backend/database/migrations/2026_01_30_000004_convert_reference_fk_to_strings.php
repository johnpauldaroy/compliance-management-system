<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('requirements')) {
            return;
        }

        Schema::table('requirements', function (Blueprint $table) {
            if (!Schema::hasColumn('requirements', 'position_ids')) {
                $table->string('position_ids')->nullable()->after('description');
            }
            if (!Schema::hasColumn('requirements', 'branch_unit_department_ids')) {
                $table->string('branch_unit_department_ids')->nullable()->after('position_ids');
            }
            if (!Schema::hasColumn('requirements', 'person_in_charge_user_ids')) {
                $table->string('person_in_charge_user_ids')->nullable()->after('branch_unit_department_ids');
            }
        });

        $hasLegacyColumns = Schema::hasColumn('requirements', 'assigned_to')
            && Schema::hasColumn('requirements', 'branch_unit_department_in_charge')
            && Schema::hasColumn('requirements', 'person_in_charge');

        $requirements = DB::table('requirements')->select('id')->get();

        foreach ($requirements as $requirement) {
            $positionIds = [];
            $branchUnitIds = [];
            $picUserIds = [];

            if ($hasLegacyColumns) {
                $legacy = DB::table('requirements')
                    ->select('assigned_to', 'branch_unit_department_in_charge', 'person_in_charge')
                    ->where('id', $requirement->id)
                    ->first();

                $positionIds = $this->resolvePositionIds($legacy?->assigned_to ?? null);
                $branchUnitIds = $this->resolveBranchUnitIds($legacy?->branch_unit_department_in_charge ?? null);
                $picUserIds = $this->resolvePersonInChargeIds($legacy?->person_in_charge ?? null);
            } else {
                if (Schema::hasTable('requirement_position')) {
                    $positionIds = DB::table('requirement_position')
                        ->where('requirement_id', $requirement->id)
                        ->orderBy('position_id')
                        ->pluck('position_id')
                        ->all();
                }
                if (Schema::hasTable('requirement_branch_unit_department')) {
                    $branchUnitIds = DB::table('requirement_branch_unit_department')
                        ->where('requirement_id', $requirement->id)
                        ->orderBy('branch_unit_department_id')
                        ->pluck('branch_unit_department_id')
                        ->all();
                }
                if (Schema::hasTable('requirement_person_in_charge')) {
                    $picUserIds = DB::table('requirement_person_in_charge')
                        ->where('requirement_id', $requirement->id)
                        ->orderBy('user_id')
                        ->pluck('user_id')
                        ->all();
                }
            }

            DB::table('requirements')
                ->where('id', $requirement->id)
                ->update([
                    'position_ids' => $positionIds ? implode(';', $positionIds) : null,
                    'branch_unit_department_ids' => $branchUnitIds ? implode(';', $branchUnitIds) : null,
                    'person_in_charge_user_ids' => $picUserIds ? implode(';', $picUserIds) : null,
                ]);
        }

        Schema::table('requirements', function (Blueprint $table) {
            if (Schema::hasColumn('requirements', 'assigned_to')) {
                $table->dropColumn('assigned_to');
            }
            if (Schema::hasColumn('requirements', 'branch_unit_department_in_charge')) {
                $table->dropColumn('branch_unit_department_in_charge');
            }
            if (Schema::hasColumn('requirements', 'person_in_charge')) {
                $table->dropColumn('person_in_charge');
            }
        });

        Schema::dropIfExists('requirement_position');
        Schema::dropIfExists('requirement_branch_unit_department');
        Schema::dropIfExists('requirement_person_in_charge');
    }

    public function down(): void
    {
        // Intentionally left minimal. Rebuilding pivot data from strings is out of scope.
    }

    private function splitValues(?string $value): array
    {
        if (!$value) {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(';', $value))));
    }

    private function resolvePositionIds(?string $assignedTo): array
    {
        $names = $this->splitValues($assignedTo);
        if (!$names) {
            return [];
        }

        $normalized = array_map(fn ($value) => Str::lower($value), $names);
        return DB::table('positions')
            ->whereIn(DB::raw('LOWER(name)'), $normalized)
            ->pluck('id')
            ->all();
    }

    private function resolveBranchUnitIds(?string $branchUnitDepartment): array
    {
        $names = $this->splitValues($branchUnitDepartment);
        if (!$names) {
            return [];
        }

        $normalized = array_map(fn ($value) => Str::lower($value), $names);
        return DB::table('branch_unit_departments')
            ->whereIn(DB::raw('LOWER(name)'), $normalized)
            ->pluck('id')
            ->all();
    }

    private function resolvePersonInChargeIds(?string $personInCharge): array
    {
        $names = $this->splitValues($personInCharge);
        if (!$names) {
            return [];
        }

        $normalized = array_map(fn ($value) => Str::lower($value), $names);
        return DB::table('users')
            ->whereIn(DB::raw('LOWER(employee_name)'), $normalized)
            ->orWhereIn(DB::raw('LOWER(user_id)'), $normalized)
            ->pluck('id')
            ->all();
    }
};
