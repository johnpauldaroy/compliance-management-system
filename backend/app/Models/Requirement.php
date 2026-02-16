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
    ];

    public function agency()
    {
        return $this->belongsTo(Agency::class);
    }

    public function assignments()
    {
        return $this->hasMany(RequirementAssignment::class);
    }
}
