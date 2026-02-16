<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Permissions
        $permissions = [
            'view audit logs',
            'manage users',
            'manage roles',
            'full crud',
            'assign pics',
            'approve uploads',
            'upload documents',
            'view own assignments',
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Roles
        $superAdmin = Role::create(['name' => 'Super Admin']);
        $superAdmin->givePermissionTo(Permission::all());

        $admin = Role::create(['name' => 'Compliance & Admin Specialist']);
        $admin->givePermissionTo([
            'manage users',
            'full crud',
            'assign pics',
            'approve uploads',
            'view own assignments',
            'upload documents',
        ]);

        $pic = Role::create(['name' => 'Person-In-Charge (PIC)']);
        $pic->givePermissionTo([
            'upload documents',
            'view own assignments',
        ]);
    }
}
