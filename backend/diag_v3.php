<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\AuditLog;
use Spatie\Permission\Models\Role;

foreach (User::all() as $user) {
    echo "USER: {$user->email} | ID: {$user->id} | ROLES: " . implode(', ', $user->getRoleNames()->toArray()) . "\n";
}
echo "AUDIT LOGS:\n";
foreach (AuditLog::with('actor')->get() as $log) {
    echo "ID: {$log->id} | Action: {$log->action} | Actor: " . ($log->actor ? $log->actor->email : 'NULL') . "\n";
}
