<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Requirement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);
        if (!$this->isSuperAdmin() && !$this->isSpecialist()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $users = User::with('roles')
            ->orderBy('employee_name')
            ->paginate(50);

        foreach ($users as $user) {
            $roleName = $user->roles->first()?->name;
            $mappedUserType = $this->userTypeForRole($roleName);
            if ($mappedUserType && $user->user_type !== $mappedUserType) {
                $user->user_type = $mappedUserType;
            }
        }

        return response()->json($users);
    }

    public function store(Request $request)
    {
        $this->authorize('create', User::class);
        if (!$this->isSuperAdmin() && !$this->isSpecialist()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'employee_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'branch' => ['required', 'string', 'max:255'],
            'user_type' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (!$this->canManageUserType($data['user_type'])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $user = User::create([
            'user_id' => $this->generateUserId($data['user_type']),
            'employee_name' => $data['employee_name'],
            'email' => $data['email'],
            'branch' => $data['branch'],
            'user_type' => $data['user_type'],
            'password' => $data['password'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        $roleName = $this->roleForUserType($data['user_type']);
        $role = $roleName ? Role::where('name', $roleName)->first() : null;
        if ($role) {
            $user->syncRoles([$role->name]);
        }

        return response()->json([
            'user' => $user->load('roles'),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $this->authorize('update', $user);
        if (!$this->isSuperAdmin() && !$this->isSpecialist()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($this->isSpecialist() && $this->isSuperAdminUser($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'employee_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'branch' => ['required', 'string', 'max:255'],
            'user_type' => ['required', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
        ]);

        if (!$this->canManageUserType($data['user_type'])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $user->update([
            'employee_name' => $data['employee_name'],
            'email' => $data['email'],
            'branch' => $data['branch'],
            'user_type' => $data['user_type'],
            'is_active' => $data['is_active'],
        ]);

        $roleName = $this->roleForUserType($data['user_type']);
        if ($roleName) {
            $user->syncRoles([$roleName]);
        }

        return response()->json([
            'user' => $user->load('roles'),
        ]);
    }

    public function resetPassword(Request $request, User $user)
    {
        $this->authorize('resetPassword', $user);
        if (!$this->isSuperAdmin() && !$this->isSpecialist()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($this->isSpecialist() && !$this->isPicUser($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update([
            'password' => Hash::make($data['password']),
        ]);

        AuditLog::create([
            'actor_user_id' => $request->user()->id,
            'action' => 'RESET_PASSWORD_ADMIN',
            'entity_type' => get_class($user),
            'entity_id' => $user->id,
            'before_json' => null,
            'after_json' => ['description' => 'Admin reset user password'],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => now(),
        ]);

        return response()->noContent();
    }

    public function details(User $user)
    {
        $this->authorize('view', $user);
        if (!$this->isSuperAdmin() && !$this->isSpecialist()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($this->isSpecialist() && $this->isSuperAdminUser($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $requirements = Requirement::with([
            'agency',
            'allAssignments.user',
            'submissions' => function ($query) use ($user) {
                $query->where(function ($submissionQuery) use ($user) {
                    $submissionQuery->where('uploaded_by_user_id', $user->id)
                        ->orWhereHas('assignment', function ($assignmentQuery) use ($user) {
                            $assignmentQuery->where('assigned_to_user_id', $user->id);
                        });
                })->with(['uploader', 'assignment.user', 'files'])
                    ->orderByDesc('upload_date');
            },
        ])
            ->where(function ($query) use ($user) {
                $query->whereHas('allAssignments', function ($assignmentQuery) use ($user) {
                    $assignmentQuery->where('assigned_to_user_id', $user->id);
                })->orWhereRaw("CONCAT(';', person_in_charge_user_ids, ';') LIKE ?", ['%;' . $user->id . ';%']);
            })
            ->orderBy('req_id')
            ->get();

        $requirements->each(function ($requirement) {
            $requirement->setRelation('assignments', $requirement->allAssignments);
        });

        return response()->json([
            'user' => $user->load('roles'),
            'requirements' => $requirements,
        ]);
    }

    public function import(Request $request)
    {
        $this->authorize('create', User::class);
        if (!$this->isSuperAdmin() && !$this->isSpecialist()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'file' => ['required', 'file'],
        ]);

        $path = $validated['file']->getRealPath();
        $extension = strtolower($validated['file']->getClientOriginalExtension());

        if (!in_array($extension, ['csv', 'xlsx'], true)) {
            return response()->json([
                'message' => 'The file field must be a file of type: csv, xlsx.',
            ], 422);
        }

        $rows = $extension === 'xlsx'
            ? $this->parseXlsx($path)
            : $this->parseCsv($path);

        if (count($rows) < 2) {
            return response()->json(['message' => 'No data rows found.'], 422);
        }

        $headerRow = array_shift($rows);
        $headerMap = $this->buildUserHeaderMap($headerRow);

        $required = ['employee_name', 'email_address', 'user_type', 'branch', 'password'];
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
            $data = $this->mapUserRow($row, $headerMap);

            $missing = array_filter($required, fn ($key) => empty($data[$key]));
            if (!empty($missing)) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => 'Missing required fields: ' . implode(', ', $missing),
                ];
                continue;
            }

            $normalizedType = $this->normalizeUserType($data['user_type']);
            if (!$normalizedType) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => "Invalid user type: {$data['user_type']}",
                ];
                continue;
            }

            if (!$this->canManageUserType($normalizedType)) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => "Forbidden user type: {$normalizedType}",
                ];
                continue;
            }

            if (User::where('email', $data['email_address'])->exists()) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => "Email already exists: {$data['email_address']}",
                ];
                continue;
            }

            try {
                $user = User::create([
                    'user_id' => $this->generateUserId($normalizedType),
                    'employee_name' => $data['employee_name'],
                    'email' => $data['email_address'],
                    'branch' => $data['branch'],
                    'user_type' => $normalizedType,
                    'password' => $data['password'],
                    'is_active' => true,
                ]);

                $roleName = $this->roleForUserType($normalizedType);
                $role = $roleName ? Role::where('name', $roleName)->first() : null;
                if ($role) {
                    $user->syncRoles([$role->name]);
                }

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

    private function roleForUserType(string $userType): ?string
    {
        return match ($userType) {
            'Super Admin' => 'Super Admin',
            'Compliance & Admin Specialist' => 'Compliance & Admin Specialist',
            'Person-in-Charge' => 'Person-In-Charge (PIC)',
            default => null,
        };
    }

    private function generateUserId(string $userType): string
    {
        $prefix = match ($userType) {
            'Super Admin' => 'SA',
            'Compliance & Admin Specialist' => 'AS',
            'Person-in-Charge' => 'PIC',
            default => 'USR',
        };

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $random = str_pad((string) random_int(1, 999), 3, '0', STR_PAD_LEFT);
            $candidate = $prefix . $random;
            if (!User::where('user_id', $candidate)->exists()) {
                return $candidate;
            }
        }

        return $prefix . str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
    }

    private function userTypeForRole(?string $roleName): ?string
    {
        if (!$roleName) {
            return null;
        }

        return match ($roleName) {
            'Super Admin' => 'Super Admin',
            'Compliance & Admin Specialist' => 'Compliance & Admin Specialist',
            'Person-In-Charge (PIC)' => 'Person-in-Charge',
            default => null,
        };
    }

    private function isSuperAdmin(): bool
    {
        return auth()->user()?->hasRole('Super Admin') ?? false;
    }

    private function isSpecialist(): bool
    {
        return auth()->user()?->hasRole(['Compliance & Admin Specialist']) ?? false;
    }

    private function canManageUserType(string $userType): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if ($this->isSpecialist()) {
            return in_array($userType, ['Compliance & Admin Specialist', 'Person-in-Charge'], true);
        }

        return false;
    }

    private function isSuperAdminUser(User $user): bool
    {
        return $user->user_type === 'Super Admin' || $user->roles->contains('name', 'Super Admin');
    }

    private function isPicUser(User $user): bool
    {
        return $user->user_type === 'Person-in-Charge' || $user->roles->contains('name', 'Person-In-Charge (PIC)');
    }

    private function buildUserHeaderMap(array $headerRow): array
    {
        $map = [];
        foreach ($headerRow as $index => $value) {
            $normalized = strtolower(trim((string) $value));
            $normalized = str_replace(['-', '/', ' '], '_', $normalized);
            $normalized = preg_replace('/_+/', '_', $normalized);

            $aliases = [
                'employee_name' => 'employee_name',
                'employee' => 'employee_name',
                'name' => 'employee_name',
                'email' => 'email_address',
                'email_address' => 'email_address',
                'user_type' => 'user_type',
                'role' => 'user_type',
                'branch' => 'branch',
                'password' => 'password',
            ];

            if (isset($aliases[$normalized])) {
                $map[$aliases[$normalized]] = $index;
            }
        }

        return $map;
    }

    private function mapUserRow(array $row, array $headerMap): array
    {
        $data = [];
        foreach ($headerMap as $key => $index) {
            $data[$key] = isset($row[$index]) ? trim((string) $row[$index]) : null;
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

    private function normalizeUserType(string $value): ?string
    {
        $normalized = strtolower(trim($value));
        $normalized = str_replace(['-', '_'], ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', $normalized);

        return match ($normalized) {
            'super admin', 'superadmin' => 'Super Admin',
            'compliance & admin specialist', 'compliance and admin specialist' => 'Compliance & Admin Specialist',
            'person in charge', 'person-in-charge', 'pic' => 'Person-in-Charge',
            default => null,
        };
    }
}
