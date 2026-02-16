<?php

namespace App\Listeners;

use App\Models\AuditLog;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Request;

class LogAuthenticationEvents
{
    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(object $event): void
    {
        if (request()->attributes->get('audit_auth_logged')) {
            return;
        }

        if ($event instanceof Login) {
            $this->logActivity($event->user, 'LOGIN', 'User Logged In');
        } elseif ($event instanceof Logout) {
            $this->logActivity($event->user, 'LOGOUT', 'User Logged Out');
        }
    }

    protected function logActivity($user, $action, $description)
    {
        if (!$user) {
            return;
        }

        AuditLog::create([
            'actor_user_id' => $user->id,
            'action' => $action,
            'entity_type' => get_class($user),
            'entity_id' => $user->id,
            'before_json' => null, // No before state for login/logout (or could be session metadata)
            'after_json' => ['description' => $description],
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'created_at' => now(),
        ]);
    }
}
