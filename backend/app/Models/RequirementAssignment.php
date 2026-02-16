<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RequirementAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'assignment_id',
        'requirement_id',
        'assigned_to_user_id',
        'deadline',
        'compliance_status',
        'last_submitted_at',
        'last_approved_at',
    ];

    protected $casts = [
        'deadline' => 'date',
        'last_submitted_at' => 'datetime',
        'last_approved_at' => 'datetime',
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
}
