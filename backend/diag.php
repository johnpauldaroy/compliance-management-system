<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\AuditLog;
use Spatie\Permission\Models\Role;

echo "--- ROLES ---\n";
foreach (Role::pluck('name') as $role) {
    echo "- $role\n";
}

echo "\n--- USERS ---\n";
foreach (User::all() as $user) {
    echo "- {$user->email} (Roles: " . implode(', ', $user->getRoleNames()->toArray()) . ")\n";
}

echo "\n--- AUDIT LOG COUNT ---\n";
echo AuditLog::count() . "\n";

echo "\n--- LATEST AUDIT LOG ---\n";
$latest = AuditLog::with('actor')->latest()->first();
if ($latest) {
    print_r($latest->toArray());
} else {
    echo "No audit logs found.\n";
}
