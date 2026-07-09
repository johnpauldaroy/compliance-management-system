<?php

namespace App\Services;

use App\Models\RequirementAssignment;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ComplianceReportService
{
    public const STATUS_COMPLIED_ON_TIME = 'complied_on_time';
    public const STATUS_COMPLIED_LATE = 'complied_late';
    public const STATUS_PENDING_APPROVAL = 'pending_approval';
    public const STATUS_PENDING_SUBMISSION = 'pending_submission';
    public const STATUS_OVERDUE = 'overdue';
    public const STATUS_REJECTED = 'rejected';

    private const STATUS_LABELS = [
        self::STATUS_COMPLIED_ON_TIME => 'Complied On Time',
        self::STATUS_COMPLIED_LATE => 'Complied Late',
        self::STATUS_PENDING_APPROVAL => 'Pending for Approval',
        self::STATUS_PENDING_SUBMISSION => 'Pending Submission',
        self::STATUS_OVERDUE => 'Overdue',
        self::STATUS_REJECTED => 'Rejected',
    ];

    public function generate(array $filters): array
    {
        $startDate = Carbon::parse($filters['start_date'])->startOfDay();
        $endDate = Carbon::parse($filters['end_date'])->endOfDay();

        $assignments = $this->queryAssignments($filters, $startDate, $endDate)->get();

        $rows = $assignments
            ->map(fn (RequirementAssignment $assignment) => $this->buildRow($assignment))
            ->filter()
            ->values();

        if (!empty($filters['status'])) {
            $rows = $rows
                ->filter(fn (array $row) => $row['status'] === $filters['status'])
                ->values();
        }

        return [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'summary' => $this->buildSummary($rows),
            'status_breakdown' => $this->buildStatusBreakdown($rows),
            'user_breakdown' => $this->buildUserBreakdown($rows),
            'agency_breakdown' => $this->buildAgencyBreakdown($rows),
            'rows' => $rows->all(),
        ];
    }

    private function queryAssignments(array $filters, Carbon $startDate, Carbon $endDate)
    {
        $query = RequirementAssignment::query()
            ->active()
            ->with([
                'user',
                'requirement.agency',
                'requirement.submissions',
            ])
            ->whereHas('requirement', fn ($requirementQuery) => $requirementQuery->active())
            ->where(function ($deadlineQuery) use ($startDate, $endDate) {
                $deadlineQuery->whereBetween('deadline', [$startDate->toDateString(), $endDate->toDateString()])
                    ->orWhere(function ($fallbackQuery) use ($startDate, $endDate) {
                        $fallbackQuery->whereNull('deadline')
                            ->whereHas('requirement', function ($requirementQuery) use ($startDate, $endDate) {
                                $requirementQuery->whereBetween('deadline', [$startDate->toDateString(), $endDate->toDateString()]);
                            });
                    });
            });

        if (!empty($filters['agency_id'])) {
            $query->whereHas('requirement', fn ($requirementQuery) => $requirementQuery->where('agency_id', $filters['agency_id']));
        }

        if (!empty($filters['user_id'])) {
            $query->where('assigned_to_user_id', $filters['user_id']);
        }

        if (!empty($filters['branch'])) {
            $query->whereHas('user', fn ($userQuery) => $userQuery->where('branch', $filters['branch']));
        }

        if (!empty($filters['frequency'])) {
            $query->whereHas('requirement', fn ($requirementQuery) => $requirementQuery->where('frequency', $filters['frequency']));
        }

        if (!empty($filters['branch_unit_department_id'])) {
            $id = (string) $filters['branch_unit_department_id'];
            $query->whereHas('requirement', function ($requirementQuery) use ($id) {
                $requirementQuery->whereRaw("CONCAT(';', COALESCE(branch_unit_department_ids, ''), ';') LIKE ?", ['%;' . $id . ';%']);
            });
        }

        return $query
            ->orderBy('deadline')
            ->orderBy('requirement_id')
            ->orderBy('sequence_order')
            ->orderBy('id');
    }

    private function buildRow(RequirementAssignment $assignment): ?array
    {
        $requirement = $assignment->requirement;
        if (!$requirement) {
            return null;
        }

        $deadline = $assignment->deadline ?: $requirement->deadline;
        if (!$deadline) {
            return null;
        }

        $deadlineDate = Carbon::parse($deadline)->toDateString();
        $matchingSubmissions = $this->matchingSubmissions($assignment, $deadlineDate);
        $approvedSubmissions = $matchingSubmissions->where('approval_status', 'APPROVED');
        $pendingSubmissions = $matchingSubmissions->where('approval_status', 'PENDING');
        $latestSubmission = $matchingSubmissions
            ->sortByDesc(fn ($submission) => $this->submissionTimestamp($submission)?->timestamp ?? 0)
            ->first();
        $latestApprovedSubmission = $approvedSubmissions
            ->sortByDesc(fn ($submission) => $this->submissionApprovedTimestamp($submission)?->timestamp ?? 0)
            ->first();

        $status = $this->resolveStatus($deadlineDate, $approvedSubmissions, $pendingSubmissions, $latestSubmission);
        $submittedAt = $latestApprovedSubmission
            ? $this->submissionTimestamp($latestApprovedSubmission)
            : $this->submissionTimestamp($latestSubmission);
        $approvedAt = $latestApprovedSubmission
            ? $this->submissionApprovedTimestamp($latestApprovedSubmission)
            : null;

        return [
            'assignment_id' => $assignment->id,
            'assignment_code' => $assignment->assignment_id,
            'requirement_id' => $requirement->id,
            'requirement_code' => $requirement->req_id,
            'requirement' => $requirement->requirement,
            'agency_id' => $requirement->agency?->id,
            'agency_code' => $requirement->agency?->agency_id,
            'agency_name' => $requirement->agency?->name,
            'user_id' => $assignment->user?->id,
            'user_code' => $assignment->user?->user_id,
            'user_name' => $assignment->user?->employee_name,
            'user_email' => $assignment->user?->email,
            'user_branch' => $assignment->user?->branch,
            'frequency' => $requirement->frequency,
            'assignment_mode' => $requirement->assignment_mode ?: 'parallel',
            'sequence_order' => $assignment->sequence_order,
            'deadline' => $deadlineDate,
            'submitted_at' => $submittedAt?->toIso8601String(),
            'approved_at' => $approvedAt?->toIso8601String(),
            'status' => $status,
            'status_label' => self::STATUS_LABELS[$status],
            'days_late' => $this->daysLate($status, $deadlineDate, $submittedAt),
            'latest_submission_id' => $latestSubmission?->id,
            'latest_submission_code' => $latestSubmission?->submission_id,
            'latest_submission_status' => $latestSubmission?->approval_status,
        ];
    }

    private function matchingSubmissions(RequirementAssignment $assignment, string $deadlineDate): Collection
    {
        $requirement = $assignment->requirement;
        $user = $assignment->user;

        return ($requirement?->submissions ?: collect())
            ->filter(function ($submission) use ($assignment, $user, $deadlineDate) {
                if (!$submission->deadline_at_upload) {
                    return false;
                }

                try {
                    if (Carbon::parse($submission->deadline_at_upload)->toDateString() !== $deadlineDate) {
                        return false;
                    }
                } catch (\Throwable $e) {
                    return false;
                }

                if ((int) $submission->assignment_id === (int) $assignment->id) {
                    return true;
                }

                if ($submission->assignment_id) {
                    return false;
                }

                if ((int) $submission->uploaded_by_user_id === (int) $assignment->assigned_to_user_id) {
                    return true;
                }

                return $user?->email
                    && $submission->uploader_email
                    && strtolower($user->email) === strtolower($submission->uploader_email);
            })
            ->values();
    }

    private function resolveStatus(string $deadlineDate, Collection $approvedSubmissions, Collection $pendingSubmissions, $latestSubmission): string
    {
        if ($approvedSubmissions->isNotEmpty()) {
            $hasOnTimeApproval = $approvedSubmissions->contains(function ($submission) use ($deadlineDate) {
                $submittedAt = $this->submissionTimestamp($submission);
                return $submittedAt && $submittedAt->lessThanOrEqualTo(Carbon::parse($deadlineDate)->endOfDay());
            });

            return $hasOnTimeApproval
                ? self::STATUS_COMPLIED_ON_TIME
                : self::STATUS_COMPLIED_LATE;
        }

        if ($pendingSubmissions->isNotEmpty()) {
            return self::STATUS_PENDING_APPROVAL;
        }

        if ($latestSubmission?->approval_status === 'REJECTED') {
            return self::STATUS_REJECTED;
        }

        return Carbon::parse($deadlineDate)->startOfDay()->lt(Carbon::today())
            ? self::STATUS_OVERDUE
            : self::STATUS_PENDING_SUBMISSION;
    }

    private function submissionTimestamp($submission): ?Carbon
    {
        $value = $submission?->upload_date ?: $submission?->created_at;
        return $value ? Carbon::parse($value) : null;
    }

    private function submissionApprovedTimestamp($submission): ?Carbon
    {
        $value = $submission?->status_change_on ?: $submission?->updated_at;
        return $value ? Carbon::parse($value) : null;
    }

    private function daysLate(string $status, string $deadlineDate, ?Carbon $submittedAt): int
    {
        $deadline = Carbon::parse($deadlineDate)->startOfDay();

        if ($submittedAt && in_array($status, [
            self::STATUS_COMPLIED_LATE,
            self::STATUS_PENDING_APPROVAL,
        ], true)) {
            return (int) max(0, $deadline->diffInDays($submittedAt->copy()->startOfDay(), false));
        }

        if (in_array($status, [
            self::STATUS_OVERDUE,
            self::STATUS_PENDING_SUBMISSION,
            self::STATUS_REJECTED,
        ], true)) {
            return (int) max(0, $deadline->diffInDays(Carbon::today(), false));
        }

        return 0;
    }

    private function buildSummary(Collection $rows): array
    {
        $counts = $rows->countBy('status');

        $totalDue = $rows->count();
        $onTime = (int) ($counts[self::STATUS_COMPLIED_ON_TIME] ?? 0);
        $late = (int) ($counts[self::STATUS_COMPLIED_LATE] ?? 0);
        $pendingApproval = (int) ($counts[self::STATUS_PENDING_APPROVAL] ?? 0);
        $pendingSubmission = (int) ($counts[self::STATUS_PENDING_SUBMISSION] ?? 0);
        $overdue = (int) ($counts[self::STATUS_OVERDUE] ?? 0);
        $rejected = (int) ($counts[self::STATUS_REJECTED] ?? 0);
        $completed = $onTime + $late;
        $open = $pendingApproval + $pendingSubmission + $overdue + $rejected;
        $lateOrOverdue = $late + $overdue + $rejected;
        $lateRows = $rows->filter(fn (array $row) => ($row['days_late'] ?? 0) > 0);
        $daysLateTotal = (int) $lateRows->sum('days_late');

        return [
            'total_due' => $rows->count(),
            'requirements' => $rows->pluck('requirement_id')->unique()->count(),
            'users' => $rows->pluck('user_id')->filter()->unique()->count(),
            self::STATUS_COMPLIED_ON_TIME => $onTime,
            self::STATUS_COMPLIED_LATE => $late,
            self::STATUS_PENDING_APPROVAL => $pendingApproval,
            self::STATUS_PENDING_SUBMISSION => $pendingSubmission,
            self::STATUS_OVERDUE => $overdue,
            self::STATUS_REJECTED => $rejected,
            'completed' => $completed,
            'open' => $open,
            'late_or_overdue' => $lateOrOverdue,
            'completion_rate' => $totalDue > 0 ? round(($completed / $totalDue) * 100, 1) : 0,
            'on_time_rate' => $completed > 0 ? round(($onTime / $completed) * 100, 1) : 0,
            'open_rate' => $totalDue > 0 ? round(($open / $totalDue) * 100, 1) : 0,
            'avg_days_late' => $lateRows->count() > 0 ? round($daysLateTotal / $lateRows->count(), 1) : 0,
            'max_days_late' => (int) ($lateRows->max('days_late') ?? 0),
        ];
    }

    private function buildStatusBreakdown(Collection $rows): array
    {
        $counts = $rows->countBy('status');

        return collect(self::STATUS_LABELS)
            ->map(fn (string $label, string $status) => [
                'status' => $status,
                'label' => $label,
                'count' => (int) ($counts[$status] ?? 0),
            ])
            ->values()
            ->all();
    }

    private function buildUserBreakdown(Collection $rows): array
    {
        return $rows
            ->groupBy('user_id')
            ->map(function (Collection $userRows) {
                $first = $userRows->first();
                $counts = $userRows->countBy('status');

                return [
                    'user_id' => $first['user_id'],
                    'user_code' => $first['user_code'],
                    'user_name' => $first['user_name'],
                    'user_branch' => $first['user_branch'],
                    'total' => $userRows->count(),
                    self::STATUS_COMPLIED_ON_TIME => (int) ($counts[self::STATUS_COMPLIED_ON_TIME] ?? 0),
                    self::STATUS_COMPLIED_LATE => (int) ($counts[self::STATUS_COMPLIED_LATE] ?? 0),
                    self::STATUS_PENDING_APPROVAL => (int) ($counts[self::STATUS_PENDING_APPROVAL] ?? 0),
                    self::STATUS_PENDING_SUBMISSION => (int) ($counts[self::STATUS_PENDING_SUBMISSION] ?? 0),
                    self::STATUS_OVERDUE => (int) ($counts[self::STATUS_OVERDUE] ?? 0),
                    self::STATUS_REJECTED => (int) ($counts[self::STATUS_REJECTED] ?? 0),
                ];
            })
            ->sortBy('user_name')
            ->values()
            ->all();
    }

    private function buildAgencyBreakdown(Collection $rows): array
    {
        return $rows
            ->groupBy('agency_id')
            ->map(function (Collection $agencyRows) {
                $first = $agencyRows->first();
                $counts = $agencyRows->countBy('status');

                return [
                    'agency_id' => $first['agency_id'],
                    'agency_code' => $first['agency_code'],
                    'agency_name' => $first['agency_name'],
                    'total' => $agencyRows->count(),
                    self::STATUS_COMPLIED_ON_TIME => (int) ($counts[self::STATUS_COMPLIED_ON_TIME] ?? 0),
                    self::STATUS_COMPLIED_LATE => (int) ($counts[self::STATUS_COMPLIED_LATE] ?? 0),
                    self::STATUS_PENDING_APPROVAL => (int) ($counts[self::STATUS_PENDING_APPROVAL] ?? 0),
                    self::STATUS_PENDING_SUBMISSION => (int) ($counts[self::STATUS_PENDING_SUBMISSION] ?? 0),
                    self::STATUS_OVERDUE => (int) ($counts[self::STATUS_OVERDUE] ?? 0),
                    self::STATUS_REJECTED => (int) ($counts[self::STATUS_REJECTED] ?? 0),
                ];
            })
            ->sortBy('agency_name')
            ->values()
            ->all();
    }
}
