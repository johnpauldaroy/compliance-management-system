<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\Requirement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RequirementImportController extends Controller
{
    public function import(Request $request)
    {
        if (!auth()->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,xlsx'],
        ]);

        $path = $validated['file']->getRealPath();
        $extension = strtolower($validated['file']->getClientOriginalExtension());

        $rows = $extension === 'xlsx'
            ? $this->parseXlsx($path)
            : $this->parseCsv($path);

        if (count($rows) < 2) {
            return response()->json(['message' => 'No data rows found.'], 422);
        }

        $headerRow = array_shift($rows);
        $headerMap = $this->buildHeaderMap($headerRow);

        $required = ['agency_id', 'category', 'requirement', 'assigned_to', 'branch_unit_department_in_charge', 'frequency'];
        foreach ($required as $requiredKey) {
            if (!isset($headerMap[$requiredKey])) {
                return response()->json([
                    'message' => "Missing required column: {$requiredKey}",
                ], 422);
            }
        }

        $created = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2;
            $data = $this->mapRow($row, $headerMap);

            $missing = array_filter($required, fn ($key) => empty($data[$key]));
            if (!empty($missing)) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => 'Missing required fields: ' . implode(', ', $missing),
                ];
                continue;
            }

            $agency = Agency::where('agency_id', strtoupper($data['agency_id']))->first();
            if (!$agency) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => "Agency not found: {$data['agency_id']}",
                ];
                continue;
            }

            try {
                $positionIds = $this->resolvePositionIds($data['assigned_to'] ?? null);
                $branchUnitIds = $this->resolveBranchUnitIds($data['branch_unit_department_in_charge'] ?? null);
                $picUserIds = $this->resolvePersonInChargeIds($data['person_in_charge'] ?? null);

                $requirement = Requirement::create([
                    'req_id' => $this->generateReqId($agency->id),
                    'agency_id' => $agency->id,
                    'category' => $data['category'],
                    'requirement' => $data['requirement'],
                    'description' => $data['description'] ?? null,
                    'frequency' => $data['frequency'],
                    'schedule' => $data['schedule'] ?? null,
                    'deadline' => $data['deadline'] ?? null,
                    'position_ids' => $positionIds ? implode(';', $positionIds) : null,
                    'branch_unit_department_ids' => $branchUnitIds ? implode(';', $branchUnitIds) : null,
                    'person_in_charge_user_ids' => $picUserIds ? implode(';', $picUserIds) : null,
                ]);
                $created++;
            } catch (\Throwable $e) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'created' => $created,
            'errors' => $errors,
        ]);
    }

    private function buildHeaderMap(array $headerRow): array
    {
        $map = [];
        foreach ($headerRow as $index => $value) {
            $normalized = strtolower(trim((string) $value));
            $normalized = str_replace(['-', '/', ' '], '_', $normalized);
            $normalized = preg_replace('/_+/', '_', $normalized);

            $aliases = [
                'agency' => 'agency_id',
                'agency_code' => 'agency_id',
                'agency_id' => 'agency_id',
                'requirement_name' => 'requirement',
                'req_name' => 'requirement',
                'req_id' => 'req_id',
                'assigned_to' => 'assigned_to',
                'assignedto' => 'assigned_to',
                'branch_unit_department_in_charge' => 'branch_unit_department_in_charge',
                'branch_unit_department' => 'branch_unit_department_in_charge',
                'branch_unit' => 'branch_unit_department_in_charge',
                'department_in_charge' => 'branch_unit_department_in_charge',
                'person_in_charge' => 'person_in_charge',
                'person_incharge' => 'person_in_charge',
                'frequency' => 'frequency',
                'schedule' => 'schedule',
                'deadline' => 'deadline',
                'description' => 'description',
                'category' => 'category',
            ];

            if (isset($aliases[$normalized])) {
                $map[$aliases[$normalized]] = $index;
            }
        }

        return $map;
    }

    private function mapRow(array $row, array $headerMap): array
    {
        $data = [];
        foreach ($headerMap as $key => $index) {
            $data[$key] = isset($row[$index]) ? trim((string) $row[$index]) : null;
        }

        if (!empty($data['agency_id'])) {
            $data['agency_id'] = strtoupper($data['agency_id']);
        }

        return $data;
    }

    private function parseCsv(string $path): array
    {
        $rows = [];
        if (($handle = fopen($path, 'r')) === false) {
            return $rows;
        }

        while (($data = fgetcsv($handle)) !== false) {
            $rows[] = $data;
        }

        fclose($handle);
        return $rows;
    }

    private function parseXlsx(string $path): array
    {
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return [];
        }

        $sharedStrings = [];
        if (($sharedXml = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
            $sharedDoc = new \SimpleXMLElement($sharedXml);
            foreach ($sharedDoc->si as $si) {
                $sharedStrings[] = (string) $si->t;
            }
        }

        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($sheetXml === false) {
            $zip->close();
            return [];
        }

        $sheet = new \SimpleXMLElement($sheetXml);
        $rows = [];

        foreach ($sheet->sheetData->row as $row) {
            $rowData = [];
            foreach ($row->c as $cell) {
                $cellRef = (string) $cell['r'];
                $col = preg_replace('/[^A-Z]/', '', $cellRef);
                $index = $this->columnIndex($col);

                $value = (string) $cell->v;
                if ((string) $cell['t'] === 's') {
                    $value = $sharedStrings[(int) $value] ?? '';
                }
                $rowData[$index] = $value;
            }

            if (!empty($rowData)) {
                $maxIndex = max(array_keys($rowData));
                $normalized = [];
                for ($i = 0; $i <= $maxIndex; $i++) {
                    $normalized[$i] = $rowData[$i] ?? '';
                }
                $rows[] = $normalized;
            }
        }

        $zip->close();
        return $rows;
    }

    private function columnIndex(string $column): int
    {
        $index = 0;
        $length = strlen($column);
        for ($i = 0; $i < $length; $i++) {
            $index = $index * 26 + (ord($column[$i]) - 64);
        }

        return $index - 1;
    }

    private function generateReqId(int $agencyId): string
    {
        return DB::transaction(function () use ($agencyId) {
            $agency = Agency::findOrFail($agencyId);
            $prefix = strtoupper($agency->agency_id);

            $latest = Requirement::where('agency_id', $agencyId)
                ->lockForUpdate()
                ->orderBy('req_id', 'desc')
                ->value('req_id');

            $nextNumber = 1;
            if ($latest && preg_match('/^' . preg_quote($prefix, '/') . '-(\d{3,})$/', $latest, $matches)) {
                $nextNumber = ((int) $matches[1]) + 1;
            }

            return $prefix . '-' . str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
        });
    }

    private function splitSemicolonValues(?string $value): array
    {
        if (!$value) {
            return [];
        }

        return array_values(array_filter(array_map('trim', explode(';', $value))));
    }

    private function resolvePositionIds(?string $assignedTo): array
    {
        $names = $this->splitSemicolonValues($assignedTo);
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
        $names = $this->splitSemicolonValues($branchUnitDepartment);
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
        $names = $this->splitSemicolonValues($personInCharge);
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
}
