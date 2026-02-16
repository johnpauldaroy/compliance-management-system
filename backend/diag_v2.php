<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\AuditLog;
use Spatie\Permission\Models\Role;

$userCount = User::count();
$roleCount = Role::count();
$auditCount = AuditLog::count();

echo "User Count: $userCount\n";
echo "Role Count: $roleCount\n";
echo "Audit Count: $auditCount\n";

$roles = Role::pluck('name')->toArray();
echo "Roles: " . implode(', ', $roles) . "\n";

foreach (User::all() as $user) {
    echo "User: {$user->email}, ID: {$user->id}, Roles: " . implode(', ', $user->getRoleNames()->toArray()) . "\n";
}

if ($auditCount > 0) {
    $logs = AuditLog::with('actor')->latest()->take(5)->get();
    foreach ($logs as $log) {
        echo "Log ID: {$log->id}, Action: {$log->action}, Actor: " . ($log->actor ? $log->actor->email : 'NULL') . "\n";
    }
}
