<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class RequirementAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'assignment_id',
        'requirement_id',
        'assigned_to_user_id',
        'sequence_order',
        'deadline',
        'compliance_status',
        'last_submitted_at',
        'last_approved_at',
        'removed_at',
        'removed_by_user_id',
    ];

    protected $casts = [
        'deadline' => 'date',
        'last_submitted_at' => 'datetime',
        'last_approved_at' => 'datetime',
        'sequence_order' => 'integer',
        'removed_at' => 'datetime',
    ];

    protected $appends = [
        'is_active',
    ];

    public function requirement()
    {
        return $this->belongsTo(Requirement::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function uploads()
    {
        return $this->hasMany(Upload::class, 'assignment_id');
    }

    public function submissions()
    {
        return $this->hasMany(UploadSubmission::class, 'assignment_id');
    }

    public function removedBy()
    {
        return $this->belongsTo(User::class, 'removed_by_user_id');
    }

    public function scopeActive($query)
    {
        if (!Schema::hasColumn('requirement_assignments', 'removed_at')) {
            return $query;
        }

        return $query->whereNull('removed_at');
    }

    public function scopeRemoved($query)
    {
        if (!Schema::hasColumn('requirement_assignments', 'removed_at')) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereNotNull('removed_at');
    }

    public function isActive(): bool
    {
        return $this->removed_at === null;
    }

    public function getIsActiveAttribute(): bool
    {
        return $this->isActive();
    }
}
