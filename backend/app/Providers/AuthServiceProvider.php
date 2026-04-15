<?php

namespace App\Providers;

use App\Models\Agency;
use App\Models\AuditLog;
use App\Models\BranchUnitDepartment;
use App\Models\Position;
use App\Models\Requirement;
use App\Models\RequirementAssignment;
use App\Models\Upload;
use App\Models\UploadSubmission;
use App\Models\User;
use App\Policies\AgencyPolicy;
use App\Policies\AuditLogPolicy;
use App\Policies\BranchUnitDepartmentPolicy;
use App\Policies\PositionPolicy;
use App\Policies\RequirementAssignmentPolicy;
use App\Policies\RequirementPolicy;
use App\Policies\UploadPolicy;
use App\Policies\UploadSubmissionPolicy;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Agency::class => AgencyPolicy::class,
        AuditLog::class => AuditLogPolicy::class,
        BranchUnitDepartment::class => BranchUnitDepartmentPolicy::class,
        Position::class => PositionPolicy::class,
        Requirement::class => RequirementPolicy::class,
        RequirementAssignment::class => RequirementAssignmentPolicy::class,
        Upload::class => UploadPolicy::class,
        UploadSubmission::class => UploadSubmissionPolicy::class,
        User::class => UserPolicy::class,
    ];
}
