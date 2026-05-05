<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use App\Models\Requirement;
use App\Models\AuditLog;
use App\Models\UploadSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function stats()
    {
        $requirements = Requirement::active()
            ->with(['assignments', 'submissions'])
            ->get();

        $totalRequirements = $requirements->count();
        $totalAgencies = Agency::count();
        $statuses = $requirements->map(fn ($requirement) => $this->summarizeRequirementStatus($requirement));
        $compliantCount = $statuses->filter(fn (string $status) => $status === 'complied')->count();
        $overdueCount = $statuses->filter(fn (string $status) => $status === 'overdue')->count();
        $pendingCount = $statuses->filter(fn (string $status) => $status === 'pending')->count();

        $forApprovalCount = UploadSubmission::where('approval_status', 'PENDING')
            ->whereHas('requirement', fn ($query) => $query->active())
            ->count();

        $complianceRate = $totalRequirements > 0
            ? round(($compliantCount / $totalRequirements) * 100, 1)
            : 0;

        return response()->json([
            'total_agencies' => $totalAgencies,
            'total_requirements' => $totalRequirements,
            'compliant' => $compliantCount,
            'pending' => $pendingCount,
            'overdue' => $overdueCount,
            'for_approval' => $forApprovalCount,
            'compliance_rate' => $complianceRate,
        ]);
    }

    public function activity()
    {
        $logs = AuditLog::with('actor')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json($logs);
    }

    public function complianceByAgency()
    {
        $user = Auth::user();
        $userId = $user?->id;
        $isPic = $user && $this->isPicUser($user);

        $stats = \App\Models\Agency::with([
            'requirements' => fn ($query) => $query->active(),
            'requirements.assignments',
            'requirements.submissions',
        ])
            ->get()
            ->map(function ($agency) use ($isPic, $userId) {
                $counts = [
                    'na' => 0,
                    'pending' => 0,
                    'overdue' => 0,
                    'complied' => 0,
                ];

                foreach ($agency->requirements as $requirement) {
                    if ($isPic && $userId) {
                        $hasAssignment = $requirement->assignments
                            ->where('assigned_to_user_id', $userId)
                            ->isNotEmpty();
                        $picList = $requirement->person_in_charge_user_ids;
                        $inPicList = $picList
                            ? str_contains(';' . $picList . ';', ';' . $userId . ';')
                            : false;
                        if (!$hasAssignment && !$inPicList) {
                            continue;
                        }
                    }
                    $status = $this->summarizeRequirementStatus($requirement);
                    if (array_key_exists($status, $counts)) {
                        $counts[$status] += 1;
                    }
                }

                $total = array_sum($counts);

                return [
                    'agency' => $agency->agency_id,
                    'name' => $agency->name,
                    'total' => $total,
                    'na' => $counts['na'],
                    'pending' => $counts['pending'],
                    'overdue' => $counts['overdue'],
                    'complied' => $counts['complied'],
                ];
            })
            ->filter(function ($agency) {
                return ($agency['total'] ?? 0) > 0;
            })
            ->values();

        return response()->json($stats);
    }

    public function calendar(Request $request)
    {
        $user = Auth::user();
        $userId = $user?->id;
        $isPic = $user && $this->isPicUser($user);
        $month = (string) $request->query('month', Carbon::today()->format('Y-m'));
        try {
            $monthStart = Carbon::createFromFormat('Y-m-d', $month . '-01')->startOfDay();
        } catch (\Throwable $e) {
            $monthStart = Carbon::today()->startOfMonth();
        }
        $monthEnd = $monthStart->copy()->endOfMonth();

        $requirementsQuery = Requirement::active()
            ->with(['assignments.user', 'submissions'])
            ->where(function ($query) use ($monthStart, $monthEnd) {
                $query->whereBetween('deadline', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->orWhereHas('assignments', function ($assignmentQuery) use ($monthStart, $monthEnd) {
                        $assignmentQuery->whereBetween('deadline', [$monthStart->toDateString(), $monthEnd->toDateString()]);
                    });
            });

        if ($isPic && $userId) {
            $requirementsQuery->where(function ($query) use ($userId) {
                $query->whereHas('assignments', function ($subQuery) use ($userId) {
                    $subQuery->where('assigned_to_user_id', $userId);
                })->orWhereRaw("CONCAT(';', person_in_charge_user_ids, ';') LIKE ?", ['%;' . $userId . ';%']);
            });
        }

        $requirements = $requirementsQuery->get();

        $byDate = [];

        foreach ($requirements as $requirement) {
            if ($requirement->assignment_mode === 'parallel') {
                $assignments = $requirement->assignments
                    ->filter(function ($assignment) use ($isPic, $userId) {
                        if (!$assignment->deadline) {
                            return false;
                        }

                        if ($isPic && $userId) {
                            return (int) $assignment->assigned_to_user_id === (int) $userId;
                        }

                        return true;
                    })
                    ->values();

                $groupedAssignments = $assignments->groupBy(function ($assignment) {
                    return Carbon::parse($assignment->deadline)->toDateString();
                });

                foreach ($groupedAssignments as $dateKey => $assignmentsForDate) {
                    $picDetails = $assignmentsForDate
                        ->map(function ($assignment) use ($requirement, $dateKey) {
                            return $this->buildCalendarPicDetail($requirement, $assignment, $dateKey);
                        })
                        ->values();

                    $status = $isPic && $userId
                        ? $this->summarizeAssignmentStatusForDeadline($requirement, $assignmentsForDate->first(), $dateKey)
                        : $this->summarizeCalendarStatusForAssignments($requirement, $assignmentsForDate, $dateKey);

                    $byDate[$dateKey][] = [
                        'id' => $requirement->id,
                        'req_id' => $requirement->req_id,
                        'name' => $requirement->requirement,
                        'status' => $status,
                        'pic' => $assignmentsForDate
                            ->pluck('user.employee_name')
                            ->filter()
                            ->unique()
                            ->values()
                            ->join(', '),
                        'pic_details' => $picDetails,
                    ];
                }

                continue;
            }

            if (!$requirement->deadline) {
                continue;
            }

            $dateKey = Carbon::parse($requirement->deadline)->toDateString();
            $status = $isPic && $userId
                ? $this->summarizeCalendarStatusForUser($requirement, $userId)
                : $this->summarizeCalendarStatus($requirement);
            $picDetails = $requirement->assignments
                ->map(function ($assignment) use ($requirement, $dateKey) {
                    return $this->buildCalendarPicDetail($requirement, $assignment, $dateKey);
                })
                ->values();
            $byDate[$dateKey][] = [
                'id' => $requirement->id,
                'req_id' => $requirement->req_id,
                'name' => $requirement->requirement,
                'status' => $status,
                'pic' => $requirement->assignments
                    ->pluck('user.employee_name')
                    ->filter()
                    ->unique()
                    ->values()
                    ->join(', '),
                'pic_details' => $picDetails,
            ];
        }

        return response()->json($byDate);
    }

    private function buildCalendarPicDetail($requirement, $assignment, string $deadlineKey): array
    {
        $user = $assignment->user;
        $latestSubmission = $this->filterSubmissionsByDeadline(
            $requirement->submissions,
            $deadlineKey,
            $assignment->id
        )
            ->sortByDesc(function ($submission) {
                $timestamp = $submission->upload_date ?? $submission->created_at;
                return $timestamp ? Carbon::parse($timestamp)->timestamp : 0;
            })
            ->first();
        $submittedAt = $latestSubmission?->upload_date ?? $latestSubmission?->created_at ?? null;
        $approvedAt = $latestSubmission?->approval_status === 'APPROVED'
            ? ($latestSubmission?->status_change_on ?? $submittedAt)
            : null;

        return [
            'id' => $assignment->id,
            'user_id' => $assignment->assigned_to_user_id,
            'name' => $user?->employee_name ?: $user?->email ?: 'Unknown',
            'status' => $this->summarizeAssignmentStatusForDeadline($requirement, $assignment, $deadlineKey),
            'submitted_at' => $submittedAt,
            'approved_at' => $approvedAt,
        ];
    }

    private function summarizeRequirementStatus($requirement): string
    {
        if (!$requirement->deadline) {
            return 'na';
        }

        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return 'pending';
        }

        $deadlineKey = Carbon::parse($requirement->deadline)->toDateString();
        $statuses = $assignments->map(fn ($assignment) => $this->resolveAssignmentStateForDeadline($requirement, $assignment, $deadlineKey));

        $allApproved = $statuses->filter(fn (string $status) => $status === 'complied')->count() === $assignments->count();
        if ($allApproved) {
            return 'complied';
        }

        if ($statuses->contains('overdue')) {
            return 'overdue';
        }

        return 'pending';
    }

    private function summarizeCalendarStatus($requirement): string
    {
        if (!$requirement->deadline) {
            return 'na';
        }

        $deadlineKey = Carbon::parse($requirement->deadline)->toDateString();
        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return 'pending';
        }

        $statuses = $assignments->map(fn ($assignment) => $this->resolveAssignmentStateForDeadline($requirement, $assignment, $deadlineKey));

        if ($statuses->contains('for_approval')) {
            return 'for_approval';
        }

        $allApproved = $statuses->filter(fn (string $status) => $status === 'complied')->count() === $assignments->count();
        if ($allApproved) {
            return 'complied';
        }

        if ($statuses->contains('overdue')) {
            return 'overdue';
        }

        return 'pending';
    }

    private function summarizeCalendarStatusForAssignments($requirement, $assignments, string $deadlineKey): string
    {
        if ($assignments->isEmpty()) {
            return 'pending';
        }

        $statuses = $assignments->map(fn ($assignment) => $this->resolveAssignmentStateForDeadline($requirement, $assignment, $deadlineKey));

        if ($statuses->contains('for_approval')) {
            return 'for_approval';
        }

        $allApproved = $statuses->filter(fn (string $status) => $status === 'complied')->count() === $assignments->count();
        if ($allApproved) {
            return 'complied';
        }

        if ($statuses->contains('overdue')) {
            return 'overdue';
        }

        return 'pending';
    }

    private function summarizeCalendarStatusForUser($requirement, int $userId): string
    {
        if (!$requirement->deadline) {
            return 'na';
        }

        $assignment = $requirement->assignments
            ->firstWhere('assigned_to_user_id', $userId);

        if (!$assignment) {
            return 'pending';
        }

        $deadlineKey = Carbon::parse($requirement->deadline)->toDateString();
        return $this->resolveAssignmentStateForDeadline($requirement, $assignment, $deadlineKey);
    }

    private function summarizeAssignmentStatusForDeadline($requirement, $assignment, string $deadlineKey): string
    {
        return $this->resolveAssignmentStateForDeadline($requirement, $assignment, $deadlineKey);
    }

    private function resolveAssignmentStateForDeadline($requirement, $assignment, string $deadlineKey): string
    {
        $submissions = $this->filterSubmissionsByDeadline(
            $requirement->submissions,
            $deadlineKey,
            $assignment->id
        );

        if ($submissions->where('approval_status', 'PENDING')->count() > 0) {
            return 'for_approval';
        }

        if ($submissions->where('approval_status', 'APPROVED')->count() > 0) {
            return 'complied';
        }

        return $this->resolveCalendarAssignmentState($assignment->compliance_status, $deadlineKey);
    }

    private function filterSubmissionsByDeadline($submissions, string $deadlineKey, int $assignmentId = null)
    {
        return $submissions->filter(function ($submission) use ($deadlineKey, $assignmentId) {
            if ($assignmentId && $submission->assignment_id !== $assignmentId) {
                return false;
            }
            if (!$submission->deadline_at_upload) {
                return false;
            }
            try {
                $dateKey = Carbon::parse($submission->deadline_at_upload)->toDateString();
            } catch (\Exception $e) {
                return false;
            }
            return $dateKey === $deadlineKey;
        });
    }

    private function isPicUser($user): bool
    {
        if (!$user) {
            return false;
        }
        if ($user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])) {
            return false;
        }
        return true;
    }

    private function resolveCalendarAssignmentState(?string $status, $deadline): string
    {
        $normalized = strtoupper((string) ($status ?: 'PENDING'));

        if ($normalized === 'APPROVED') {
            return 'complied';
        }

        if ($normalized === 'SUBMITTED') {
            return 'for_approval';
        }

        if ($this->isPastDeadline($deadline)) {
            return 'overdue';
        }

        return 'pending';
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
