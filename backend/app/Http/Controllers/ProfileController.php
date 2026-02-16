<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user()->load('roles');
        $roleName = $user->roles->first()?->name;
        $mappedUserType = $roleName ? $this->userTypeForRole($roleName) : null;

        if ($mappedUserType && $user->user_type !== $mappedUserType) {
            $user->user_type = $mappedUserType;
            $user->save();
        }

        return response()->json([
            'user' => $user,
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'employee_name' => ['required', 'string', 'max:255'],
            'branch' => ['required', 'string', 'max:255'],
            'user_type' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
        ]);

        $roleName = $user->roles()->pluck('name')->first();
        $restrictedRoles = ['Compliance & Admin Specialist', 'Person-In-Charge (PIC)'];
        $hasRestrictedRole = $roleName && in_array($roleName, $restrictedRoles, true);
        if ($hasRestrictedRole) {
            $mappedUserType = $this->userTypeForRole($roleName);
            if ($mappedUserType) {
                $data['user_type'] = $mappedUserType;
            } else {
                unset($data['user_type']);
            }
        } else {
            $mappedRole = $this->roleForUserType($data['user_type']);
            if ($mappedRole) {
                $user->syncRoles([$mappedRole]);
            }
        }

        $user->fill($data);
        $user->save();

        return response()->json([
            'user' => $user->load('roles'),
        ]);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();
        $user->update([
            'password' => $request->password,
        ]);

        AuditLog::create([
            'actor_user_id' => $user->id,
            'action' => 'RESET_PASSWORD',
            'entity_type' => get_class($user),
            'entity_id' => $user->id,
            'before_json' => null,
            'after_json' => ['description' => 'User reset password'],
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

    private function userTypeForRole(string $roleName): ?string
    {
        return match ($roleName) {
            'Super Admin' => 'Super Admin',
            'Compliance & Admin Specialist' => 'Admin Specialist',
            'Person-In-Charge (PIC)' => 'Person-in-Charge',
            default => null,
        };
    }
}
