<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Agency;
use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

try {
    $admin = User::where('email', 'admin@cms.com')->first();
    Auth::login($admin);
    echo "Logged in as: " . Auth::user()->email . "\n";

    echo "Creating agency...\n";
    $agency = Agency::create([
        'name' => 'Test Agency ' . time(),
        'code' => 'TEST' . time(),
    ]);
    echo "Agency created with ID: {$agency->id}\n";

    echo "Checking audit logs...\n";
    $latest = AuditLog::latest()->first();
    echo "Latest Audit Log: ID {$latest->id}, Action: {$latest->action}, Entity: {$latest->entity_type}\n";
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
