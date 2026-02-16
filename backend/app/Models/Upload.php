<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Upload extends Model
{
    use HasFactory;

    protected $fillable = [
        'upload_id',
        'requirement_id',
        'assignment_id',
        'doc_file',
        'uploaded_by_user_id',
        'uploader_email',
        'upload_date',
        'comments',
        'approval_status',
        'status_change_on',
        'admin_remarks',
        'upload_year',
    ];

    protected $casts = [
        'upload_date' => 'datetime',
        'status_change_on' => 'datetime',
    ];

    public function requirement()
    {
        return $this->belongsTo(Requirement::class, 'requirement_id');
    }

    public function assignment()
    {
        return $this->belongsTo(RequirementAssignment::class, 'assignment_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }
}
