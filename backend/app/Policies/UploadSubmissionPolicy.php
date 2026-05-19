<?php

namespace App\Policies;

use App\Models\UploadSubmission;
use App\Models\RequirementAssignment;
use App\Models\User;

class UploadSubmissionPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, UploadSubmission $submission): bool
    {
        if ($user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])) {
            return true;
        }

        if ($submission->uploaded_by_user_id === $user->id) {
            return true;
        }

        if ($submission->assignment && $submission->assignment->assigned_to_user_id === $user->id) {
            return true;
        }

        if ($submission->approval_status === 'APPROVED') {
            return RequirementAssignment::where('requirement_id', $submission->requirement_id)
                ->where('assigned_to_user_id', $user->id)
                ->exists();
        }

        return false;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function approve(User $user, UploadSubmission $submission): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist']);
    }

    public function reject(User $user, UploadSubmission $submission): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist']);
    }

    public function update(User $user, UploadSubmission $submission): bool
    {
        return $user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist']);
    }
}
