<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditLogObserver
{
    public function created(Model $model): void
    {
        $this->logActivity($model, 'CREATED', [], $model->toArray());
    }

    public function updated(Model $model): void
    {
        // Only log if attributes actually changed
        if ($model->wasChanged()) {
            $before = $model->getOriginal();
            $after = $model->getChanges();

            unset($before['password'], $after['password']);
            if (empty($after)) {
                return;
            }

            $this->logActivity($model, $this->updateActionFor($model), $before, $after);
        }
    }

    public function deleted(Model $model): void
    {
        $this->logActivity($model, 'DELETED', $model->toArray(), []);
    }

    protected function logActivity(Model $model, string $action, array $before, array $after): void
    {
        // Avoid infinite loop if AuditLog itself is being observed (it shouldn't be, but safety first)
        if ($model instanceof AuditLog) {
            return;
        }

        $actorId = Auth::id();

        // Require an actor for audit logs as per user requirement
        if (!$actorId) {
            return;
        }

        AuditLog::create([
            'actor_user_id' => $actorId,
            'action' => $action,
            'entity_type' => get_class($model),
            'entity_id' => $model->getKey(),
            'before_json' => !empty($before) ? $before : null,
            'after_json' => !empty($after) ? $after : null,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'created_at' => now(),
        ]);
    }

    protected function updateActionFor(Model $model): string
    {
        $class = class_basename($model);
        $map = [
            'User' => 'UPDATE_PROFILE',
            'Agency' => 'UPDATE_AGENCY',
            'Requirement' => 'UPDATE_REQUIREMENT',
            'Upload' => 'UPDATE_UPLOAD',
        ];

        return $map[$class] ?? 'UPDATED';
    }
}
