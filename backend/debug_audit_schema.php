<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use App\Models\AuditLog;

use Illuminate\Support\Facades\Request;

echo "Request IP: " . (Request::ip() ?? 'NULL') . "\n";
echo "Request UA: " . (Request::userAgent() ?? 'NULL') . "\n";

try {
    $count = DB::table('agency_groups')->count();
    echo "Agency Groups Count: $count\n";
    if ($count == 0) {
        DB::table('agency_groups')->insert(['name' => 'Test Group', 'code' => 'TEST']);
        echo "Inserted dummy agency group.\n";
    }
} catch (\Exception $e) {
    echo "Agency Groups Error: " . $e->getMessage() . "\n";
}

echo "--- Table Structure ---\n";
try {
    $columns = DB::select('DESCRIBE audit_logs');
    foreach ($columns as $col) {
        echo "{$col->Field} | {$col->Type} | Null: {$col->Null} | Key: {$col->Key} | Default: {$col->Default}\n";
    }
} catch (\Exception $e) {
    echo "Error describing table: " . $e->getMessage() . "\n";
}

echo "\n--- Manual Insert Test ---\n";
try {
    $log = AuditLog::create([
        'action' => 'TEST_MANUAL',
        'entity_type' => 'ManualTest',
        'entity_id' => 999,
        // actor_user_id is not provided, should be null (and allowed)
    ]);
    echo "INSERT SUCCESS: Created log ID {$log->id}\n";
} catch (\Exception $e) {
    echo "INSERT FAILED: " . $e->getMessage() . "\n";
}
