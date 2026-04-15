<?php

namespace App\Services;

use App\Models\Requirement;
use App\Models\RequirementAssignment;
use App\Models\Upload;
use App\Models\UploadSubmission;
use App\Models\User;
use App\Mail\SubmissionPendingReviewMail;
use App\Mail\SubmissionStatusMail;
use App\Mail\RequirementDeadlineMail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class UploadSubmissionService
{
    public function createSubmission(Request $request, User $user, array $files): UploadSubmission
    {
        $requirement = Requirement::findOrFail($request->requirement_id);

        $isAdmin = $user->hasAnyRole(['Compliance & Admin Specialist', 'Super Admin']);

        $assignment = RequirementAssignment::where('requirement_id', $requirement->id)
            ->where('assigned_to_user_id', $user->id)
            ->first();

        if ($isAdmin && $request->filled('assignment_id')) {
            $assignment = RequirementAssignment::where('requirement_id', $requirement->id)
                ->where('id', $request->assignment_id)
                ->first();
            if (!$assignment) {
                throw new HttpResponseException(
                    response()->json(['message' => 'Selected PIC assignment is invalid for this requirement.'], 422)
                );
            }
        } elseif ($isAdmin && !$assignment) {
            $assignmentCount = $requirement->assignments()->count();
            if ($assignmentCount === 1) {
                $assignment = $requirement->assignments()->first();
            } elseif ($assignmentCount > 1) {
                throw new HttpResponseException(
                    response()->json(['message' => 'Please select a PIC to upload for.'], 422)
                );
            }
        }

        if ($user->hasRole('Person-In-Charge (PIC)') && !$assignment) {
            throw new HttpResponseException(
                response()->json(['message' => 'Unauthorized: You are not assigned to this requirement.'], 403)
            );
        }

        if ($assignment && $this->isSequentialRequirement($requirement)) {
            $activeAssignment = $requirement->activeSequentialAssignment();
            if ($activeAssignment && $activeAssignment->id !== $assignment->id) {
                throw new HttpResponseException(
                    response()->json(['message' => 'You cannot submit yet. This requirement is in sequential mode and is assigned to another PIC first.'], 403)
                );
            }
        }

        $deadlineDate = $assignment?->deadline ?? $requirement->deadline;
        if (!$isAdmin && !$deadlineDate) {
            throw new HttpResponseException(
                response()->json(['message' => 'Uploads are disabled until a deadline is set for this requirement.'], 422)
            );
        }

        if (!$isAdmin && $deadlineDate) {
            $deadlineKey = Carbon::parse($deadlineDate)->toDateString();
            $approvedExistsQuery = UploadSubmission::where('requirement_id', $requirement->id)
                ->where('approval_status', 'APPROVED')
                ->whereDate('deadline_at_upload', $deadlineKey);

            if ($assignment) {
                $approvedExistsQuery->where('assignment_id', $assignment->id);
            } else {
                $approvedExistsQuery->where('uploaded_by_user_id', $user->id);
            }

            if ($approvedExistsQuery->exists()) {
                throw new HttpResponseException(
                    response()->json(['message' => 'An approved submission already exists for this deadline.'], 422)
                );
            }

            $pendingExistsQuery = UploadSubmission::where('requirement_id', $requirement->id)
                ->where('approval_status', 'PENDING')
                ->whereDate('deadline_at_upload', $deadlineKey);

            if ($assignment) {
                $pendingExistsQuery->where('assignment_id', $assignment->id);
            } else {
                $pendingExistsQuery->where('uploaded_by_user_id', $user->id);
            }

            if ($pendingExistsQuery->exists()) {
                throw new HttpResponseException(
                    response()->json(['message' => 'An upload is already pending approval for this deadline.'], 422)
                );
            }
        }

        $canSetApproval = $user->hasRole('Compliance & Admin Specialist') || $user->hasRole('Super Admin');
        $approvalStatus = $canSetApproval && $request->filled('approval_status')
            ? $request->approval_status
            : 'PENDING';
        $adminRemarks = $canSetApproval ? $request->admin_remarks : null;

        return DB::transaction(function () use ($request, $requirement, $assignment, $files, $user, $approvalStatus, $adminRemarks, $isAdmin, $deadlineDate) {
            $submission = UploadSubmission::create([
                'submission_id' => 'SUB-' . uniqid(),
                'requirement_id' => $requirement->id,
                'assignment_id' => $assignment?->id,
                'uploaded_by_user_id' => $user->id,
                'uploader_email' => $user->email,
                'upload_date' => now(),
                'deadline_at_upload' => $isAdmin
                    ? ($request->input('deadline_at_upload') ?: $deadlineDate)
                    : $deadlineDate,
                'comments' => $request->comments,
                'approval_status' => $approvalStatus,
                'admin_remarks' => $adminRemarks,
                'status_change_on' => $approvalStatus === 'PENDING' ? null : now(),
                'upload_year' => now()->year,
            ]);

            $uploads = [];

            foreach ($files as $file) {
                $originalName = method_exists($file, 'getClientOriginalName')
                    ? $file->getClientOriginalName()
                    : null;
                $path = $file->store('compliance_docs');
                $uploads[] = Upload::create([
                    'upload_id' => 'UP-' . uniqid(),
                    'submission_id' => $submission->id,
                    'requirement_id' => $requirement->id,
                    'assignment_id' => $assignment?->id,
                    'doc_file' => $path,
                    'original_file_name' => $originalName,
                    'uploaded_by_user_id' => $user->id,
                    'uploader_email' => $user->email,
                    'upload_date' => $submission->upload_date,
                    'deadline_at_upload' => $submission->deadline_at_upload,
                    'comments' => null,
                    'approval_status' => $approvalStatus,
                    'admin_remarks' => $adminRemarks,
                    'status_change_on' => $submission->status_change_on,
                    'upload_year' => $submission->upload_year,
                ]);
            }

            if ($assignment) {
                $statusMap = [
                    'APPROVED' => 'APPROVED',
                    'REJECTED' => 'REJECTED',
                    'PENDING' => 'SUBMITTED',
                ];
                $assignmentStatus = $statusMap[$approvalStatus] ?? 'SUBMITTED';

                $updateData = [
                    'compliance_status' => $assignmentStatus,
                ];

                if ($assignmentStatus === 'SUBMITTED') {
                    $updateData['last_submitted_at'] = now();
                } elseif ($assignmentStatus === 'APPROVED') {
                    $updateData['last_approved_at'] = now();
                    $updateData['last_submitted_at'] = now();
                }

                $assignment->update($updateData);

                if ($this->isSequentialRequirement($requirement) && $this->isSequentialCompletionStatus($assignmentStatus)) {
                    DB::afterCommit(function () use ($assignment) {
                        $this->notifyNextSequentialPic($assignment);
                    });
                }
            }

            if ($approvalStatus === 'PENDING') {
                DB::afterCommit(function () use ($submission) {
                    $this->notifySpecialistsPendingReview($submission);
                });
            }

            $submission->setRelation('files', collect($uploads));

            return $submission;
        });
    }

    public function approveSubmission(UploadSubmission $submission, ?string $remarks): UploadSubmission
    {
        return DB::transaction(function () use ($submission, $remarks) {
            $submission->update([
                'approval_status' => 'APPROVED',
                'status_change_on' => now(),
                'admin_remarks' => $remarks,
            ]);

            if ($submission->assignment) {
                $submission->assignment->update([
                    'compliance_status' => 'APPROVED',
                    'last_approved_at' => now(),
                ]);
            }

            $submission->files()->update([
                'approval_status' => 'APPROVED',
                'status_change_on' => now(),
                'admin_remarks' => $remarks,
            ]);

            DB::afterCommit(function () use ($submission) {
                $this->notifySubmissionStatus($submission);
                if ($submission->assignment && $this->isSequentialRequirement($submission->requirement)) {
                    $this->notifyNextSequentialPic($submission->assignment);
                }
                $this->maybeRollMonthlyDeadlineOnApproval($submission);
            });

            return $submission;
        });
    }

    public function rejectSubmission(UploadSubmission $submission, string $remarks): UploadSubmission
    {
        return DB::transaction(function () use ($submission, $remarks) {
            $submission->update([
                'approval_status' => 'REJECTED',
                'status_change_on' => now(),
                'admin_remarks' => $remarks,
            ]);

            if ($submission->assignment) {
                $submission->assignment->update([
                    'compliance_status' => 'PENDING',
                ]);
            }

            $submission->files()->update([
                'approval_status' => 'REJECTED',
                'status_change_on' => now(),
                'admin_remarks' => $remarks,
            ]);

            DB::afterCommit(function () use ($submission) {
                $this->notifySubmissionStatus($submission);
            });

            return $submission;
        });
    }

    private function notifySpecialistsPendingReview(UploadSubmission $submission): void
    {
        $specialistEmails = User::role(['Compliance & Admin Specialist', 'Super Admin'])
            ->pluck('email')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($specialistEmails)) {
            return;
        }

        try {
            Mail::to($specialistEmails)->send(new SubmissionPendingReviewMail($submission));
        } catch (\Throwable $e) {
            \Log::error('Failed to send pending review email', [
                'submission_id' => $submission->id,
                'emails' => $specialistEmails,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function notifySubmissionStatus(UploadSubmission $submission): void
    {
        $submission->loadMissing(['uploader', 'assignment.user', 'requirement']);

        $recipientEmail = $submission->uploader?->email
            ?? $submission->assignment?->user?->email
            ?? $submission->uploader_email;

        if (!$recipientEmail) {
            return;
        }

        try {
            Mail::to($recipientEmail)->send(new SubmissionStatusMail($submission));
        } catch (\Throwable $e) {
            \Log::error('Failed to send submission status email', [
                'submission_id' => $submission->id,
                'email' => $recipientEmail,
                'status' => $submission->approval_status,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function isSequentialRequirement(Requirement $requirement): bool
    {
        return $requirement->assignment_mode === 'sequential';
    }

    private function isSequentialCompletionStatus(string $status): bool
    {
        return $status === 'APPROVED';
    }

    private function notifyNextSequentialPic(RequirementAssignment $currentAssignment): void
    {
        $currentAssignment->loadMissing(['requirement']);
        $requirement = $currentAssignment->requirement;
        if (!$requirement || !$this->isSequentialRequirement($requirement)) {
            return;
        }

        if (!$this->isSequentialCompletionStatus($currentAssignment->compliance_status)) {
            return;
        }

        $ordered = $requirement->assignments()
            ->orderByRaw('CASE WHEN sequence_order IS NULL THEN 1 ELSE 0 END')
            ->orderBy('sequence_order')
            ->orderBy('id')
            ->get();

        $currentIndex = $ordered->search(function (RequirementAssignment $assignment) use ($currentAssignment) {
            return $assignment->id === $currentAssignment->id;
        });

        if ($currentIndex === false) {
            return;
        }

        $nextAssignment = $ordered->slice($currentIndex + 1)
            ->first(function (RequirementAssignment $assignment) {
                return !$this->isSequentialCompletionStatus($assignment->compliance_status);
            });

        if (!$nextAssignment) {
            return;
        }

        $nextAssignment->loadMissing(['user', 'requirement']);
        $pic = $nextAssignment->user;
        if (!$pic || !$pic->email) {
            return;
        }

        try {
            Mail::to($pic->email)->send(new RequirementDeadlineMail($nextAssignment, 'activated'));
        } catch (\Throwable $e) {
            \Log::error('Failed to send sequential activation email', [
                'assignment_id' => $nextAssignment->id,
                'email' => $pic->email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function maybeRollMonthlyDeadlineOnApproval(UploadSubmission $submission): void
    {
        $submission->loadMissing(['requirement', 'requirement.assignments.user']);
        $requirement = $submission->requirement;
        if (!$requirement) {
            return;
        }
        if (!$requirement->auto_deadline_enabled) {
            return;
        }
        if (stripos((string) $requirement->frequency, 'month') === false) {
            return;
        }

        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return;
        }
        if ($assignments->contains(fn ($assignment) => $assignment->compliance_status !== 'APPROVED')) {
            return;
        }

        $lastApprovedAt = $assignments->max('last_approved_at');
        if (!$lastApprovedAt) {
            return;
        }
        $eligibleAt = Carbon::parse($lastApprovedAt)->addDays(2)->startOfDay();
        if (Carbon::now()->lt($eligibleAt)) {
            return;
        }

        $baseDate = $submission->deadline_at_upload ?: $requirement->deadline;
        if (!$baseDate) {
            return;
        }

        $base = Carbon::parse($baseDate);
        $now = Carbon::today();
        if ($base->year !== $now->year || $base->month !== $now->month) {
            return;
        }

        $next = $base->copy()->addMonthNoOverflow()->toDateString();
        $currentDeadline = $requirement->deadline ? Carbon::parse($requirement->deadline) : null;
        if ($currentDeadline && Carbon::parse($next)->lessThanOrEqualTo($currentDeadline)) {
            return;
        }

        $requirement->update(['deadline' => $next]);
        $requirement->assignments()->update([
            'deadline' => $next,
            'compliance_status' => 'PENDING',
            'last_submitted_at' => null,
            'last_approved_at' => null,
        ]);

        $requirement->load('assignments.user');
        if ($this->isSequentialRequirement($requirement)) {
            $active = $requirement->activeSequentialAssignment();
            if ($active) {
                $pic = $active->user;
                if ($pic && $pic->email) {
                    try {
                        Mail::to($pic->email)->send(new RequirementDeadlineMail($active, 'updated'));
                    } catch (\Throwable $e) {
                        \Log::error('Failed to send monthly deadline update email', [
                            'assignment_id' => $active->id,
                            'email' => $pic->email,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }
            return;
        }

        foreach ($requirement->assignments as $assignment) {
            $pic = $assignment->user;
            if (!$pic || !$pic->email) {
                continue;
            }
            try {
                Mail::to($pic->email)->send(new RequirementDeadlineMail($assignment, 'updated'));
            } catch (\Throwable $e) {
                \Log::error('Failed to send monthly deadline update email', [
                    'assignment_id' => $assignment->id,
                    'email' => $pic->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
