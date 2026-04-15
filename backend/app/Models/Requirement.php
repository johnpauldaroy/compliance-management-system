<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Requirement extends Model
{
    use HasFactory;

    protected $fillable = [
        'req_id',
        'agency_id',
        'category',
        'requirement',
        'description',
        'position_ids',
        'branch_unit_department_ids',
        'person_in_charge_user_ids',
        'frequency',
        'schedule',
        'deadline',
        'auto_deadline_enabled',
        'assignment_mode',
    ];

    protected $casts = [
        'deadline' => 'date',
        'auto_deadline_enabled' => 'boolean',
    ];

    public function agency()
    {
        return $this->belongsTo(Agency::class);
    }

    public function assignments()
    {
        return $this->hasMany(RequirementAssignment::class)
            ->orderByRaw('CASE WHEN sequence_order IS NULL THEN 1 ELSE 0 END')
            ->orderBy('sequence_order')
            ->orderBy('id');
    }

    public function uploads()
    {
        return $this->hasMany(Upload::class, 'requirement_id');
    }

    public function submissions()
    {
        return $this->hasMany(UploadSubmission::class, 'requirement_id');
    }

    public function isSequential(): bool
    {
        return $this->assignment_mode === 'sequential';
    }

    public function activeSequentialAssignment(): ?RequirementAssignment
    {
        if (!$this->isSequential()) {
            return null;
        }

        $assignments = $this->assignments()->get();
        return $assignments->first(function (RequirementAssignment $assignment) {
            return !in_array($assignment->compliance_status, ['SUBMITTED', 'APPROVED'], true);
        });
    }
}
