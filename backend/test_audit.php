<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

try {
    $admin = User::where('email', 'admin@cms.com')->first();
    Auth::login($admin);
    echo "Logged in as: " . Auth::user()->email . " (ID: " . Auth::id() . ")\n";

    echo "Updating user...\n";
    $admin->employee_name = "Admin " . time();
    $admin->save();
    echo "User updated.\n";

    echo "Checking audit logs...\n";
    $latest = AuditLog::latest()->first();
    if ($latest && $latest->id != 4) {
        echo "SUCCESS: New audit log created: ID {$latest->id}, Action: {$latest->action}\n";
    } else {
        echo "FAILURE: No new audit log created.\n";
    }
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
