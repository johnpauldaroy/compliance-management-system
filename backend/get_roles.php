<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

foreach (Spatie\Permission\Models\Role::all() as $r) {
    echo "EXACT_ROLE:[" . $r->name . "]\n";
}
