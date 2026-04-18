<?php

namespace App\Console\Commands;

use App\Models\Requirement;
use App\Models\RequirementAssignment;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SyncAssignmentStatesFromSubmissions extends Command
{
    protected $signature = 'requirements:sync-assignment-states {--dry-run : Show changes without writing}';
    protected $description = 'Repair assignment status and timestamps from submission records';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $checked = 0;
        $updated = 0;

        Requirement::with(['assignments', 'submissions'])
            ->chunkById(100, function ($requirements) use (&$checked, &$updated, $dryRun) {
                foreach ($requirements as $requirement) {
                    foreach ($requirement->assignments as $assignment) {
                        $checked++;
                        $state = $this->buildAssignmentState($requirement, $assignment);
                        $payload = $this->buildUpdatePayload($assignment, $state);

                        if (empty($payload)) {
                            continue;
                        }

                        $updated++;
                        $this->line(sprintf(
                            'Requirement %s assignment %d -> %s',
                            $requirement->req_id ?: ('#' . $requirement->id),
                            $assignment->id,
                            json_encode($payload, JSON_UNESCAPED_SLASHES)
                        ));

                        if (!$dryRun) {
                            $assignment->update($payload);
                        }
                    }
                }
            });

        $summary = $dryRun ? 'Would update' : 'Updated';
        $this->info(sprintf('%s %d assignment(s) after checking %d.', $summary, $updated, $checked));

        return self::SUCCESS;
    }

    private function buildUpdatePayload(RequirementAssignment $assignment, array $state): array
    {
        $payload = [];
        $currentStatus = strtoupper((string) ($assignment->compliance_status ?: 'PENDING'));
        if ($currentStatus !== $state['status']) {
            $payload['compliance_status'] = $state['status'];
        }

        $currentSubmittedAt = $this->normalizeTimestamp($assignment->last_submitted_at);
        $nextSubmittedAt = $this->normalizeTimestamp($state['last_submitted_at']);
        if ($currentSubmittedAt !== $nextSubmittedAt) {
            $payload['last_submitted_at'] = $nextSubmittedAt;
        }

        $currentApprovedAt = $this->normalizeTimestamp($assignment->last_approved_at);
        $nextApprovedAt = $this->normalizeTimestamp($state['last_approved_at']);
        if ($currentApprovedAt !== $nextApprovedAt) {
            $payload['last_approved_at'] = $nextApprovedAt;
        }

        return $payload;
    }

    private function buildAssignmentState(Requirement $requirement, RequirementAssignment $assignment): array
    {
        $matchingSubmissions = $this->matchAssignmentSubmissions($requirement, $assignment);
        $latestSubmission = $matchingSubmissions
            ->sortByDesc(fn ($submission) => $this->submissionTimestamp($submission)?->timestamp ?? 0)
            ->first();
        $latestApprovedSubmission = $matchingSubmissions
            ->where('approval_status', 'APPROVED')
            ->sortByDesc(fn ($submission) => $this->submissionApprovedTimestamp($submission)?->timestamp ?? 0)
            ->first();

        $storedStatus = strtoupper((string) ($assignment->compliance_status ?: 'PENDING'));
        if ($matchingSubmissions->where('approval_status', 'PENDING')->isNotEmpty()) {
            $status = 'SUBMITTED';
        } elseif ($latestApprovedSubmission) {
            $status = 'APPROVED';
        } elseif ($this->isPastDeadline($assignment->deadline)) {
            $status = 'OVERDUE';
        } elseif ($storedStatus === 'REJECTED') {
            $status = 'PENDING';
        } else {
            $status = $storedStatus ?: 'PENDING';
        }

        return [
            'status' => $status,
            'last_submitted_at' => $latestSubmission
                ? $this->submissionTimestamp($latestSubmission)
                : $assignment->last_submitted_at,
            'last_approved_at' => $latestApprovedSubmission
                ? $this->submissionApprovedTimestamp($latestApprovedSubmission)
                : $assignment->last_approved_at,
        ];
    }

    private function matchAssignmentSubmissions(Requirement $requirement, RequirementAssignment $assignment)
    {
        $deadlineKey = $assignment->deadline
            ? Carbon::parse($assignment->deadline)->toDateString()
            : ($requirement->deadline ? Carbon::parse($requirement->deadline)->toDateString() : null);
        if (!$deadlineKey) {
            return collect();
        }

        return $requirement->submissions
            ->filter(function ($submission) use ($assignment, $deadlineKey) {
                if (!$submission->deadline_at_upload) {
                    return false;
                }

                try {
                    $submissionDeadlineKey = Carbon::parse($submission->deadline_at_upload)->toDateString();
                } catch (\Throwable $e) {
                    return false;
                }

                if ($submissionDeadlineKey !== $deadlineKey) {
                    return false;
                }

                if ($submission->assignment_id) {
                    return (int) $submission->assignment_id === (int) $assignment->id;
                }

                return (int) $submission->uploaded_by_user_id === (int) $assignment->assigned_to_user_id;
            })
            ->values();
    }

    private function submissionTimestamp($submission): ?Carbon
    {
        $timestamp = $submission->upload_date ?? $submission->created_at ?? null;
        if (!$timestamp) {
            return null;
        }

        try {
            return Carbon::parse($timestamp);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function submissionApprovedTimestamp($submission): ?Carbon
    {
        $timestamp = $submission->status_change_on ?? $submission->upload_date ?? $submission->created_at ?? null;
        if (!$timestamp) {
            return null;
        }

        try {
            return Carbon::parse($timestamp);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function normalizeTimestamp($value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateTimeString();
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function isPastDeadline($deadline): bool
    {
        if (!$deadline) {
            return false;
        }

        try {
            return Carbon::parse($deadline)->startOfDay()->lt(Carbon::today());
        } catch (\Throwable $e) {
            return false;
        }
    }
}
