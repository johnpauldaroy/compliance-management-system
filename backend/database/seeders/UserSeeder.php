<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Super Admin
        $superAdmin = User::updateOrCreate([
            'user_id' => 'SA001',
        ], [
            'employee_name' => 'Super Admin',
            'email' => 'admin@cms.com',
            'branch' => 'Head Office',
            'user_type' => 'Super Admin',
            'is_active' => true,
            'password' => '12345678',
        ]);
        $superAdmin->assignRole('Super Admin');

        // Admin Specialist
        $admin = User::updateOrCreate([
            'user_id' => 'AS001',
        ], [
            'employee_name' => 'Admin Specialist',
            'email' => 'specialist@cms.com',
            'branch' => 'Head Office',
            'user_type' => 'Admin Specialist',
            'is_active' => true,
            'password' => '12345678',
        ]);
        $admin->assignRole('Compliance & Admin Specialist');

        // PIC
        $pic = User::updateOrCreate([
            'user_id' => 'PIC001',
        ], [
            'employee_name' => 'Branch PIC 1',
            'email' => 'pic1@cms.com',
            'branch' => 'Branch A',
            'user_type' => 'Person-in-Charge',
            'is_active' => true,
            'password' => '12345678',
        ]);
        $pic->assignRole('Person-In-Charge (PIC)');
    }
}
