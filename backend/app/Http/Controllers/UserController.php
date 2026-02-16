<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request)
    {
        if (!auth()->user()->hasRole('Super Admin')) {
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
                $user->save();
            }
        }

        return response()->json($users);
    }

    public function store(Request $request)
    {
        if (!auth()->user()->hasRole('Super Admin')) {
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
        if (!auth()->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'employee_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'branch' => ['required', 'string', 'max:255'],
            'user_type' => ['required', 'string', 'max:255'],
            'is_active' => ['required', 'boolean'],
        ]);

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
        if (!auth()->user()->hasRole('Super Admin')) {
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

    private function roleForUserType(string $userType): ?string
    {
        return match ($userType) {
            'Super Admin' => 'Super Admin',
            'Admin Specialist' => 'Compliance & Admin Specialist',
            'Person-in-Charge' => 'Person-In-Charge (PIC)',
            default => null,
        };
    }

    private function generateUserId(string $userType): string
    {
        $prefix = match ($userType) {
            'Super Admin' => 'SA',
            'Admin Specialist' => 'AS',
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
            'Compliance & Admin Specialist' => 'Admin Specialist',
            'Person-In-Charge (PIC)' => 'Person-in-Charge',
            default => null,
        };
    }
}
