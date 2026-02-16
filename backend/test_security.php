<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\Auth;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'admin@cms.com';
$wrongPassword = 'definitely-wrong-password';

echo "Testing login for $email with wrong password...\n";

$user = User::where('email', $email)->first();
if (!$user) {
    die("User not found!\n");
}

echo "User found. Current password hash: " . $user->password . "\n";
echo "Verifying Hash::check('admin123', hash): " . (Hash::check('admin123', $user->password) ? 'TRUE' : 'FALSE') . "\n";
echo "Verifying Hash::check('$wrongPassword', hash): " . (Hash::check($wrongPassword, $user->password) ? 'TRUE' : 'FALSE') . "\n";

$credentials = ['email' => $email, 'password' => $wrongPassword];
$attempt = Auth::attempt($credentials);

echo "Auth::attempt result: " . ($attempt ? 'TRUE' : 'FALSE') . "\n";

if ($attempt) {
    echo "SECURITY REACH: Logged in as: " . Auth::user()->email . "\n";
} else {
    echo "Auth::attempt correctly failed.\n";
}
