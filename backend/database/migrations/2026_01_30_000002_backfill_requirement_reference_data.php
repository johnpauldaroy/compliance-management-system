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

        if ($hasLegacyColumns) {
            $requirements = DB::table('requirements')
                ->select('id', 'assigned_to', 'branch_unit_department_in_charge', 'person_in_charge')
                ->get();

            foreach ($requirements as $requirement) {
                $positionIds = $this->resolvePositionIds($requirement->assigned_to);
                $branchUnitIds = $this->resolveBranchUnitIds($requirement->branch_unit_department_in_charge);
                $picUserIds = $this->resolvePersonInChargeIds($requirement->person_in_charge);

                DB::table('requirements')
                    ->where('id', $requirement->id)
                    ->update([
                        'position_ids' => $positionIds ? implode(';', $positionIds) : null,
                        'branch_unit_department_ids' => $branchUnitIds ? implode(';', $branchUnitIds) : null,
                        'person_in_charge_user_ids' => $picUserIds ? implode(';', $picUserIds) : null,
                    ]);
            }
        } elseif (
            Schema::hasTable('requirement_position') ||
            Schema::hasTable('requirement_branch_unit_department') ||
            Schema::hasTable('requirement_person_in_charge')
        ) {
            $requirements = DB::table('requirements')->select('id')->get();
            foreach ($requirements as $requirement) {
                $positionIds = Schema::hasTable('requirement_position')
                    ? DB::table('requirement_position')
                        ->where('requirement_id', $requirement->id)
                        ->orderBy('position_id')
                        ->pluck('position_id')
                        ->all()
                    : [];

                $branchUnitIds = Schema::hasTable('requirement_branch_unit_department')
                    ? DB::table('requirement_branch_unit_department')
                        ->where('requirement_id', $requirement->id)
                        ->orderBy('branch_unit_department_id')
                        ->pluck('branch_unit_department_id')
                        ->all()
                    : [];

                $picUserIds = Schema::hasTable('requirement_person_in_charge')
                    ? DB::table('requirement_person_in_charge')
                        ->where('requirement_id', $requirement->id)
                        ->orderBy('user_id')
                        ->pluck('user_id')
                        ->all()
                    : [];

                DB::table('requirements')
                    ->where('id', $requirement->id)
                    ->update([
                        'position_ids' => $positionIds ? implode(';', $positionIds) : null,
                        'branch_unit_department_ids' => $branchUnitIds ? implode(';', $branchUnitIds) : null,
                        'person_in_charge_user_ids' => $picUserIds ? implode(';', $picUserIds) : null,
                    ]);
            }
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
    }

    public function down(): void
    {
        Schema::table('requirements', function (Blueprint $table) {
            if (Schema::hasColumn('requirements', 'position_ids')) {
                $table->dropColumn('position_ids');
            }
            if (Schema::hasColumn('requirements', 'branch_unit_department_ids')) {
                $table->dropColumn('branch_unit_department_ids');
            }
            if (Schema::hasColumn('requirements', 'person_in_charge_user_ids')) {
                $table->dropColumn('person_in_charge_user_ids');
            }
        });

        Schema::table('requirements', function (Blueprint $table) {
            if (!Schema::hasColumn('requirements', 'assigned_to')) {
                $table->string('assigned_to')->nullable()->after('description');
            }
            if (!Schema::hasColumn('requirements', 'branch_unit_department_in_charge')) {
                $table->string('branch_unit_department_in_charge')->nullable()->after('assigned_to');
            }
            if (!Schema::hasColumn('requirements', 'person_in_charge')) {
                $table->string('person_in_charge')->nullable()->after('branch_unit_department_in_charge');
            }
        });
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

        $positions = DB::table('positions')
            ->select('id', 'name')
            ->whereIn(DB::raw('LOWER(name)'), array_map(fn ($value) => Str::lower($value), $names))
            ->get()
            ->keyBy(fn ($row) => Str::lower($row->name));

        $ids = [];
        foreach ($names as $name) {
            $position = $positions[Str::lower($name)] ?? null;
            if ($position) {
                $ids[] = $position->id;
            }
        }

        return $ids;
    }

    private function resolveBranchUnitIds(?string $branchUnits): array
    {
        $names = $this->splitValues($branchUnits);
        if (!$names) {
            return [];
        }

        $units = DB::table('branch_unit_departments')
            ->select('id', 'name')
            ->whereIn(DB::raw('LOWER(name)'), array_map(fn ($value) => Str::lower($value), $names))
            ->get()
            ->keyBy(fn ($row) => Str::lower($row->name));

        $ids = [];
        foreach ($names as $name) {
            $unit = $units[Str::lower($name)] ?? null;
            if ($unit) {
                $ids[] = $unit->id;
            }
        }

        return $ids;
    }

    private function resolvePersonInChargeIds(?string $personInCharge): array
    {
        $names = $this->splitValues($personInCharge);
        if (!$names) {
            return [];
        }

        $lowerNames = array_map(fn ($value) => Str::lower($value), $names);

        return DB::table('users')
            ->whereIn(DB::raw('LOWER(employee_name)'), $lowerNames)
            ->orWhereIn(DB::raw('LOWER(user_id)'), $lowerNames)
            ->pluck('id')
            ->all();
    }
};
