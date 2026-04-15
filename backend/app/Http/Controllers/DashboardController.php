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
        $totalRequirements = Requirement::count();
        $totalAgencies = Agency::count();

        $compliantCount = Requirement::whereNotNull('deadline')
            ->whereHas('assignments')
            ->whereDoesntHave('assignments', function ($query) {
                $query->where('compliance_status', '!=', 'APPROVED');
            })
            ->count();

        $overdueCount = Requirement::whereNotNull('deadline')
            ->whereHas('assignments', function ($query) {
                $query->where('compliance_status', 'OVERDUE');
            })->count();

        $pendingCount = Requirement::whereNotNull('deadline')
            ->where(function ($query) {
                $query->whereDoesntHave('assignments')
                    ->orWhere(function ($subQuery) {
                        $subQuery->whereHas('assignments', function ($assignmentQuery) {
                            $assignmentQuery->where('compliance_status', '!=', 'APPROVED');
                        })->whereDoesntHave('assignments', function ($assignmentQuery) {
                            $assignmentQuery->where('compliance_status', 'OVERDUE');
                        });
                    });
            })->count();

        $forApprovalCount = UploadSubmission::where('approval_status', 'PENDING')->count();

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

        $stats = \App\Models\Agency::with(['requirements.assignments'])
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

    public function calendar()
    {
        $user = Auth::user();
        $userId = $user?->id;
        $isPic = $user && $this->isPicUser($user);

        $requirementsQuery = Requirement::with(['assignments.user', 'submissions'])
            ->whereNotNull('deadline');

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
            if (!$requirement->deadline) {
                continue;
            }
            $dateKey = Carbon::parse($requirement->deadline)->toDateString();
            $status = $isPic && $userId
                ? $this->summarizeCalendarStatusForUser($requirement, $userId)
                : $this->summarizeCalendarStatus($requirement);
            $picDetails = $requirement->assignments
                ->map(function ($assignment) use ($requirement, $dateKey) {
                    $user = $assignment->user;
                    $latestSubmission = $this->filterSubmissionsByDeadline(
                        $requirement->submissions,
                        $dateKey,
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
                        'status' => $this->summarizeAssignmentStatusForDeadline($requirement, $assignment, $dateKey),
                        'submitted_at' => $submittedAt,
                        'approved_at' => $approvedAt,
                    ];
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

    private function summarizeRequirementStatus($requirement): string
    {
        if (!$requirement->deadline) {
            return 'na';
        }

        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return 'pending';
        }

        $hasOverdue = $assignments->where('compliance_status', 'OVERDUE')->count() > 0;
        if ($hasOverdue) {
            return 'overdue';
        }

        $allApproved = $assignments->where('compliance_status', 'APPROVED')->count() === $assignments->count();
        if ($allApproved) {
            return 'complied';
        }

        return 'pending';
    }

    private function summarizeCalendarStatus($requirement): string
    {
        if (!$requirement->deadline) {
            return 'na';
        }

        $deadlineKey = Carbon::parse($requirement->deadline)->toDateString();
        $submissions = $this->filterSubmissionsByDeadline($requirement->submissions, $deadlineKey);
        if ($submissions->where('approval_status', 'PENDING')->count() > 0) {
            return 'for_approval';
        }

        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return 'pending';
        }

        if ($assignments->where('compliance_status', 'OVERDUE')->count() > 0) {
            return 'overdue';
        }

        $allApproved = $assignments->where('compliance_status', 'APPROVED')->count() === $assignments->count();
        if ($allApproved) {
            return 'complied';
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
        $userSubmissions = $this->filterSubmissionsByDeadline(
            $requirement->submissions,
            $deadlineKey,
            $assignment->id
        );

        if ($userSubmissions->where('approval_status', 'PENDING')->count() > 0) {
            return 'for_approval';
        }

        if ($assignment->compliance_status === 'OVERDUE') {
            return 'overdue';
        }

        if ($assignment->compliance_status === 'APPROVED') {
            return 'complied';
        }

        if ($assignment->compliance_status === 'SUBMITTED') {
            return 'for_approval';
        }

        return 'pending';
    }

    private function summarizeAssignmentStatusForDeadline($requirement, $assignment, string $deadlineKey): string
    {
        $submissions = $this->filterSubmissionsByDeadline(
            $requirement->submissions,
            $deadlineKey,
            $assignment->id
        );

        if ($submissions->where('approval_status', 'PENDING')->count() > 0) {
            return 'for_approval';
        }

        $status = $assignment->compliance_status;
        if ($status === 'OVERDUE') {
            return 'overdue';
        }
        if ($status === 'APPROVED') {
            return 'complied';
        }
        if ($status === 'SUBMITTED') {
            return 'for_approval';
        }

        return 'pending';
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
}
