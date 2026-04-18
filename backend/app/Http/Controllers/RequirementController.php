<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use App\Models\Requirement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use App\Mail\RequirementDeadlineMail;
use App\Models\RequirementAssignment;
use Illuminate\Validation\ValidationException;

class RequirementController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Requirement::class);
        $perPage = (int) $request->query('per_page', 25);
        $perPage = $perPage > 0 ? min($perPage, 200) : 25;
        $today = Carbon::today()->toDateString();

        $query = Requirement::with(['agency', 'assignments.user', 'assignments.submissions']);

        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->query('agency_id'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('status')) {
            $status = strtolower((string) $request->query('status'));
            if ($status === 'na') {
                $query->whereNull('deadline');
            } elseif ($status === 'compliant' || $status === 'complied') {
                $query->whereNotNull('deadline')
                    ->whereHas('assignments')
                    ->whereDoesntHave('assignments', function ($assignmentQuery) {
                        $assignmentQuery->where('compliance_status', '!=', 'APPROVED');
                    });
            } elseif ($status === 'overdue') {
                $query->whereNotNull('deadline')
                    ->whereHas('assignments', function ($assignmentQuery) use ($today) {
                        $assignmentQuery->whereNotNull('deadline')
                            ->whereDate('deadline', '<', $today)
                            ->whereNotIn('compliance_status', ['APPROVED', 'SUBMITTED']);
                    });
            } elseif ($status === 'pending') {
                $query->whereNotNull('deadline')
                    ->where(function ($statusQuery) use ($today) {
                        $statusQuery->whereDoesntHave('assignments')
                            ->orWhere(function ($subQuery) use ($today) {
                                $subQuery->whereHas('assignments', function ($assignmentQuery) {
                                    $assignmentQuery->where('compliance_status', '!=', 'APPROVED');
                                })->whereDoesntHave('assignments', function ($assignmentQuery) use ($today) {
                                    $assignmentQuery->whereNotNull('deadline')
                                        ->whereDate('deadline', '<', $today)
                                        ->whereNotIn('compliance_status', ['APPROVED', 'SUBMITTED']);
                                });
                            });
                    });
            }
        }

        if ($request->filled('search')) {
            $term = trim((string) $request->query('search'));
            $query->where(function ($q) use ($term) {
                $q->where('req_id', 'like', '%' . $term . '%')
                    ->orWhere('requirement', 'like', '%' . $term . '%')
                    ->orWhere('category', 'like', '%' . $term . '%')
                    ->orWhere('frequency', 'like', '%' . $term . '%')
                    ->orWhere('schedule', 'like', '%' . $term . '%')
                    ->orWhere('description', 'like', '%' . $term . '%')
                    ->orWhereHas('agency', function ($agencyQuery) use ($term) {
                        $agencyQuery->where('name', 'like', '%' . $term . '%')
                            ->orWhere('agency_id', 'like', '%' . $term . '%');
                    });
            });
        }

        $sortBy = strtolower((string) $request->query('sort_by', 'id'));
        $sortDir = strtolower((string) $request->query('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';

        if ($sortBy === 'requirement') {
            $query->orderBy('requirement', $sortDir);
        } elseif ($sortBy === 'req_id') {
            $query->orderBy('req_id', $sortDir);
        } else {
            $query->orderBy('id', $sortDir);
        }

        $page = $query->paginate($perPage);
        $page->getCollection()->each(function ($requirement) {
            $requirement->compliance_status = $this->summarizeComplianceStatus($requirement);
        });

        return response()->json($page);
    }

    public function myRequirements()
    {
        $user = Auth::user();
        $userId = $user->id;

        $requirements = Requirement::with([
            'agency',
            'assignments' => function ($query) use ($user) {
                $query->where('assigned_to_user_id', $user->id);
            },
            'assignments.submissions.uploader',
            'submissions.files',
            'submissions.uploader',
            'submissions.assignment.user',
        ])->where(function ($query) use ($userId) {
            $query->whereHas('assignments', function ($subQuery) use ($userId) {
                $subQuery->where('assigned_to_user_id', $userId);
            })->orWhereRaw("CONCAT(';', person_in_charge_user_ids, ';') LIKE ?", ['%;' . $userId . ';%']);
        })->get();

        $requirements->each(function ($requirement) use ($user) {
            $this->applyComputedAssignmentStatuses($requirement);
            $assignment = $this->resolveViewerAssignment($requirement, $user) ?? $requirement->assignments->first();
            $requirement->compliance_status = $assignment ? $this->resolveAssignmentStatus($assignment) : 'PENDING';
            $this->applyViewerDeadlineContext($requirement, $user);
        });

        return response()->json($requirements);
    }

    public function export(Request $request)
    {
        $this->authorize('viewAny', Requirement::class);
        $query = Requirement::with(['agency', 'assignments.user']);

        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->query('agency_id'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('search')) {
            $term = trim((string) $request->query('search'));
            $query->where(function ($q) use ($term) {
                $q->where('req_id', 'like', '%' . $term . '%')
                    ->orWhere('requirement', 'like', '%' . $term . '%')
                    ->orWhere('category', 'like', '%' . $term . '%')
                    ->orWhere('frequency', 'like', '%' . $term . '%')
                    ->orWhere('schedule', 'like', '%' . $term . '%')
                    ->orWhere('description', 'like', '%' . $term . '%')
                    ->orWhereHas('agency', function ($agencyQuery) use ($term) {
                        $agencyQuery->where('name', 'like', '%' . $term . '%')
                            ->orWhere('agency_id', 'like', '%' . $term . '%');
                    });
            });
        }

        $requirements = $query->orderByDesc('updated_at')->get();

        $headers = [
            'Req ID',
            'Agency ID',
            'Agency',
            'Category',
            'Requirement',
            'Description',
            'Frequency',
            'Schedule',
            'Deadline',
            'Overall Status',
            'Assigned People',
        ];

        $fileName = 'requirements_export_' . now()->format('Ymd') . '.csv';

        return response()->streamDownload(function () use ($requirements, $headers) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $headers);

            foreach ($requirements as $requirement) {
                /** @var \App\Models\Requirement $requirement */
                $assignedNames = $requirement->assignments->pluck('user.employee_name')->filter()->join('; ');
                fputcsv($out, [
                    $requirement->req_id,
                    $requirement->agency?->agency_id,
                    $requirement->agency?->name,
                    $requirement->category,
                    $requirement->requirement,
                    $requirement->description,
                    $requirement->frequency,
                    $requirement->schedule,
                    $requirement->deadline,
                    $this->summarizeComplianceStatus($requirement),
                    $assignedNames,
                ]);
            }

            fclose($out);
        }, $fileName, ['Content-Type' => 'text/csv']);
    }

    public function store(Request $request)
    {
        $this->authorize('create', Requirement::class);
        $validated = $request->validate([
            'agency_id' => 'required|exists:agencies,id',
            'category' => 'required|string',
            'requirement' => 'required|string',
            'description' => 'nullable|string',
            'frequency' => 'required|string',
            'schedule' => 'nullable|string',
            'deadline' => 'nullable|date|after_or_equal:today',
            'auto_deadline_enabled' => 'sometimes|boolean',
            'assignment_mode' => 'nullable|in:parallel,sequential',
            'position_ids' => 'nullable',
            'branch_unit_department_ids' => 'nullable',
            'person_in_charge_user_ids' => 'nullable',
            'sequential_deadlines' => 'nullable|array',
            'sequential_deadlines.*.assigned_to_user_id' => 'required_with:sequential_deadlines|integer',
            'sequential_deadlines.*.deadline' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            // The schedule column is currently non-nullable in production schema.
            $validated['schedule'] = $validated['schedule'] ?? '';
            $validated['req_id'] = $this->generateReqId((int) $validated['agency_id']);
            $validated['auto_deadline_enabled'] = $this->normalizeAutoDeadlineFlag(
                $validated['frequency'],
                array_key_exists('auto_deadline_enabled', $validated) ? $validated['auto_deadline_enabled'] : null
            );
            $validated['assignment_mode'] = $this->normalizeAssignmentMode($validated['assignment_mode'] ?? null);

            // Still keep the strings for now to maintain frontend compatibility during transition
            $validated['position_ids'] = $this->normalizeIdList($validated['position_ids'] ?? null);
            $validated['branch_unit_department_ids'] = $this->normalizeIdList($validated['branch_unit_department_ids'] ?? null);
            $validated['person_in_charge_user_ids'] = $this->normalizeIdList($validated['person_in_charge_user_ids'] ?? null);

            $picUserIds = $this->parseIdList($validated['person_in_charge_user_ids']);
            $sequentialDeadlines = $this->resolveSequentialDeadlines(
                $validated['assignment_mode'],
                $picUserIds,
                $request->input('sequential_deadlines')
            );

            if ($validated['assignment_mode'] === 'sequential' && !empty($sequentialDeadlines)) {
                $validated['deadline'] = $this->deriveSequentialRequirementDeadline($sequentialDeadlines);
            }

            $requirement = Requirement::create($validated);

            $assignments = [];
            $sequence = 1;
            foreach ($picUserIds as $userId) {
                $assignments[] = RequirementAssignment::create([
                    'assignment_id' => 'ASGN-' . strtoupper(\Illuminate\Support\Str::random(10)),
                    'requirement_id' => $requirement->id,
                    'assigned_to_user_id' => $userId,
                    'sequence_order' => $validated['assignment_mode'] === 'sequential' ? $sequence : null,
                    'deadline' => $validated['assignment_mode'] === 'sequential'
                        ? ($sequentialDeadlines[$userId] ?? null)
                        : $requirement->deadline,
                    'compliance_status' => 'PENDING',
                ]);
                $sequence++;
            }

            DB::afterCommit(function () use ($assignments) {
                $this->notifyAssignmentsDeadline($assignments, 'assigned');
            });

            return response()->json($requirement, 211);
        });
    }

    public function show(Requirement $requirement)
    {
        $this->authorize('view', $requirement);
        $viewer = Auth::user();
        $requirement->load([
            'agency',
            'assignments.user',
            'assignments.submissions.uploader',
            'submissions.files',
            'submissions.uploader',
            'submissions.assignment.user',
        ]);
        $this->applyComputedAssignmentStatuses($requirement);
        $viewerAssignment = $this->resolveViewerAssignment($requirement, $viewer);
        $this->applyViewerDeadlineContext($requirement, $viewer);
        $requirement->compliance_status = $viewerAssignment && !$viewer?->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])
            ? $this->resolveAssignmentStatus($viewerAssignment)
            : $this->summarizeComplianceStatus($requirement);

        return response()->json($requirement);
    }

    public function update(Request $request, Requirement $requirement)
    {
        $this->authorize('update', $requirement);
        $validated = $request->validate([
            'category' => 'string',
            'requirement' => 'string',
            'description' => 'nullable|string',
            'frequency' => 'string',
            'schedule' => 'nullable|string',
            'deadline' => 'nullable|date|after_or_equal:today',
            'auto_deadline_enabled' => 'sometimes|boolean',
            'assignment_mode' => 'nullable|in:parallel,sequential',
            'position_ids' => 'nullable',
            'branch_unit_department_ids' => 'nullable',
            'person_in_charge_user_ids' => 'nullable',
            'sequential_deadlines' => 'nullable|array',
            'sequential_deadlines.*.assigned_to_user_id' => 'required_with:sequential_deadlines|integer',
            'sequential_deadlines.*.deadline' => 'nullable|date',
        ]);

        return DB::transaction(function () use ($validated, $requirement, $request) {
            $originalDeadline = $requirement->deadline;
            $originalAssignmentMode = $requirement->assignment_mode ?: 'parallel';
            $originalOrderedPicUserIds = $requirement->assignments()
                ->orderByRaw('CASE WHEN sequence_order IS NULL THEN 1 ELSE 0 END')
                ->orderBy('sequence_order')
                ->orderBy('id')
                ->pluck('assigned_to_user_id')
                ->toArray();
            $newAssignments = [];
            $newPicUserIds = null;
            $sequentialDeadlinesChanged = false;
            $assignmentMode = array_key_exists('assignment_mode', $validated)
                ? $this->normalizeAssignmentMode($validated['assignment_mode'])
                : $originalAssignmentMode;
            if (array_key_exists('schedule', $validated) && $validated['schedule'] === null) {
                // Keep compatibility with deployments where requirements.schedule is NOT NULL.
                $validated['schedule'] = '';
            }
            if (array_key_exists('assignment_mode', $validated)) {
                $validated['assignment_mode'] = $assignmentMode;
            }
            if (array_key_exists('position_ids', $validated)) {
                $validated['position_ids'] = $this->normalizeIdList($validated['position_ids']);
            }
            if (array_key_exists('branch_unit_department_ids', $validated)) {
                $validated['branch_unit_department_ids'] = $this->normalizeIdList($validated['branch_unit_department_ids']);
            }

            if (array_key_exists('person_in_charge_user_ids', $validated)) {
                $validated['person_in_charge_user_ids'] = $this->normalizeIdList($validated['person_in_charge_user_ids']);
                $newPicUserIds = array_values(array_unique($this->parseIdList($validated['person_in_charge_user_ids'])));
                $oldPicUserIds = $requirement->assignments()->pluck('assigned_to_user_id')->toArray();

                // Remove assignments no longer in the list
                $toRemove = array_diff($oldPicUserIds, $newPicUserIds);
                if (!empty($toRemove)) {
                    $hasUploadedAssignments = $requirement->assignments()
                        ->whereIn('assigned_to_user_id', $toRemove)
                        ->whereHas('submissions')
                        ->exists();

                    if ($hasUploadedAssignments) {
                        throw ValidationException::withMessages([
                            'person_in_charge_user_ids' => ['Cannot remove assigned person-in-charge with existing submissions.'],
                        ]);
                    }
                }
                $requirement->assignments()->whereIn('assigned_to_user_id', $toRemove)->delete();
            }

            $frequency = $validated['frequency'] ?? $requirement->frequency;
            $autoDeadlineInput = array_key_exists('auto_deadline_enabled', $validated)
                ? $validated['auto_deadline_enabled']
                : $requirement->auto_deadline_enabled;
            $validated['auto_deadline_enabled'] = $this->normalizeAutoDeadlineFlag($frequency, $autoDeadlineInput);

            $orderedPicUserIds = $newPicUserIds
                ?? $requirement->assignments()
                    ->orderByRaw('CASE WHEN sequence_order IS NULL THEN 1 ELSE 0 END')
                    ->orderBy('sequence_order')
                    ->orderBy('id')
                    ->pluck('assigned_to_user_id')
                    ->toArray();

            $sequentialDeadlinesProvided = array_key_exists('sequential_deadlines', $validated);
            $sequentialDeadlines = $this->resolveSequentialDeadlines(
                $assignmentMode,
                $orderedPicUserIds,
                $sequentialDeadlinesProvided
                    ? $request->input('sequential_deadlines')
                    : $this->serializeSequentialDeadlinesFromAssignments($requirement)
            );

            if ($assignmentMode === 'sequential') {
                if (!empty($orderedPicUserIds)) {
                    $toAdd = array_diff($orderedPicUserIds, $requirement->assignments()->pluck('assigned_to_user_id')->toArray());
                    foreach ($toAdd as $userId) {
                        $newAssignments[] = RequirementAssignment::create([
                            'assignment_id' => 'ASGN-' . strtoupper(\Illuminate\Support\Str::random(10)),
                            'requirement_id' => $requirement->id,
                            'assigned_to_user_id' => $userId,
                            'sequence_order' => null,
                            'deadline' => $sequentialDeadlines[$userId] ?? null,
                            'compliance_status' => 'PENDING',
                        ]);
                    }
                }

                foreach ($orderedPicUserIds as $index => $userId) {
                    $assignment = RequirementAssignment::where('requirement_id', $requirement->id)
                        ->where('assigned_to_user_id', $userId)
                        ->first();

                    if (!$assignment) {
                        continue;
                    }

                    $nextDeadline = $sequentialDeadlines[$userId] ?? null;
                    $currentDeadline = $assignment->deadline ? Carbon::parse($assignment->deadline)->toDateString() : null;
                    if ($currentDeadline !== $nextDeadline) {
                        $sequentialDeadlinesChanged = true;
                    }

                    $assignment->update([
                        'sequence_order' => $index + 1,
                        'deadline' => $nextDeadline,
                    ]);
                }

                $validated['deadline'] = $this->deriveSequentialRequirementDeadline($sequentialDeadlines);
            } else {
                $existingUserIds = $requirement->assignments()->pluck('assigned_to_user_id')->toArray();
                $toAdd = array_diff($orderedPicUserIds, $existingUserIds);
                foreach ($toAdd as $userId) {
                    $newAssignments[] = RequirementAssignment::create([
                        'assignment_id' => 'ASGN-' . strtoupper(\Illuminate\Support\Str::random(10)),
                        'requirement_id' => $requirement->id,
                        'assigned_to_user_id' => $userId,
                        'deadline' => $validated['deadline'] ?? $requirement->deadline,
                        'compliance_status' => 'PENDING',
                    ]);
                }

                if ($assignmentMode !== $requirement->assignment_mode || $newPicUserIds !== null) {
                    $requirement->assignments()->update(['sequence_order' => null]);
                }
            }

            $requirement->update($validated);

            if ($assignmentMode !== 'sequential' && isset($validated['deadline'])) {
                $requirement->assignments()->update(['deadline' => $validated['deadline']]);
            }

            $deadlineChanged = array_key_exists('deadline', $validated)
                && $validated['deadline']
                && $validated['deadline'] !== $originalDeadline;

            if ($assignmentMode === 'sequential' && !$deadlineChanged) {
                $deadlineChanged = $sequentialDeadlinesChanged;
            }

            $workflowChanged = $assignmentMode !== $originalAssignmentMode
                || ($assignmentMode === 'sequential' && $orderedPicUserIds !== $originalOrderedPicUserIds);

            if (!$deadlineChanged && $workflowChanged) {
                $deadlineChanged = true;
            }

            if ($deadlineChanged) {
                $requirement->assignments()->update([
                    'compliance_status' => 'PENDING',
                    'last_submitted_at' => null,
                    'last_approved_at' => null,
                ]);
            }

            if ($deadlineChanged) {
                $allAssignments = $requirement->assignments()->with('user', 'requirement')->get();
                DB::afterCommit(function () use ($allAssignments) {
                    $this->notifyAssignmentsDeadline($allAssignments, 'updated');
                });
            } elseif (!empty($newAssignments)) {
                if ($assignmentMode === 'sequential') {
                    $active = $requirement->activeSequentialAssignment();
                    if ($active && collect($newAssignments)->contains('id', $active->id)) {
                        DB::afterCommit(function () use ($active) {
                            $this->notifyAssignmentsDeadline([$active], 'assigned');
                        });
                    }
                } else {
                    DB::afterCommit(function () use ($newAssignments) {
                        $this->notifyAssignmentsDeadline($newAssignments, 'assigned');
                    });
                }
            }

            return response()->json($requirement);
        });
    }

    public function destroy(Requirement $requirement)
    {
        $this->authorize('delete', $requirement);
        $requirement->delete();
        return response()->noContent();
    }

    private function generateReqId(int $agencyId): string
    {
        return DB::transaction(function () use ($agencyId) {
            $agency = \App\Models\Agency::findOrFail($agencyId);
            $prefix = strtoupper($agency->agency_id);

            $latest = Requirement::where('agency_id', $agencyId)
                ->lockForUpdate()
                ->orderBy('req_id', 'desc')
                ->value('req_id');

            $nextNumber = 1;
            if ($latest && preg_match('/^' . preg_quote($prefix, '/') . '-(\d{3,})$/', $latest, $matches)) {
                $nextNumber = ((int) $matches[1]) + 1;
            }

            return $prefix . '-' . str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
        });
    }

    private function normalizeIdList($value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            $ids = array_filter(array_map('intval', $value));
            return $ids ? implode(';', $ids) : null;
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            return $trimmed === '' ? null : $trimmed;
        }

        return null;
    }

    private function normalizeAssignmentMode(?string $mode): string
    {
        $normalized = strtolower(trim((string) $mode));
        return $normalized === 'sequential' ? 'sequential' : 'parallel';
    }

    private function isMonthlyFrequency(?string $frequency): bool
    {
        if (!$frequency) {
            return false;
        }
        return stripos($frequency, 'month') !== false;
    }

    private function normalizeAutoDeadlineFlag(?string $frequency, ?bool $requestedValue): bool
    {
        if (!$this->isMonthlyFrequency($frequency)) {
            return false;
        }

        return $requestedValue ?? true;
    }

    private function parseIdList(?string $value): array
    {
        if (!$value) {
            return [];
        }

        $parts = preg_split('/\s*;\s*/', $value);
        return array_values(array_filter(array_map('intval', $parts)));
    }

    private function resolveSequentialDeadlines(string $assignmentMode, array $picUserIds, $rawDeadlines): array
    {
        if ($assignmentMode !== 'sequential' || empty($picUserIds)) {
            return [];
        }

        if (!is_array($rawDeadlines)) {
            throw ValidationException::withMessages([
                'sequential_deadlines' => ['Set a deadline for each PIC in sequential mode.'],
            ]);
        }

        $deadlineMap = [];
        foreach ($rawDeadlines as $row) {
            if (!is_array($row)) {
                continue;
            }

            $userId = (int) ($row['assigned_to_user_id'] ?? 0);
            $deadline = isset($row['deadline']) && $row['deadline'] !== ''
                ? Carbon::parse($row['deadline'])->toDateString()
                : null;

            if ($userId > 0) {
                $deadlineMap[$userId] = $deadline;
            }
        }

        $ordered = [];
        $previousDeadline = null;
        foreach ($picUserIds as $index => $userId) {
            $deadline = $deadlineMap[$userId] ?? null;
            if (!$deadline) {
                throw ValidationException::withMessages([
                    'sequential_deadlines' => ['Set a deadline for every sequential PIC.'],
                ]);
            }

            if ($previousDeadline && Carbon::parse($deadline)->lt(Carbon::parse($previousDeadline))) {
                throw ValidationException::withMessages([
                    'sequential_deadlines' => ['Sequential PIC deadlines must stay in sequence order.'],
                ]);
            }

            $ordered[$userId] = $deadline;
            $previousDeadline = $deadline;
        }

        return $ordered;
    }

    private function deriveSequentialRequirementDeadline(array $sequentialDeadlines): ?string
    {
        if (empty($sequentialDeadlines)) {
            return null;
        }

        $deadlines = array_values($sequentialDeadlines);
        return end($deadlines) ?: null;
    }

    private function serializeSequentialDeadlinesFromAssignments(Requirement $requirement): array
    {
        return $requirement->assignments()
            ->orderByRaw('CASE WHEN sequence_order IS NULL THEN 1 ELSE 0 END')
            ->orderBy('sequence_order')
            ->orderBy('id')
            ->get()
            ->map(function (RequirementAssignment $assignment) {
                return [
                    'assigned_to_user_id' => $assignment->assigned_to_user_id,
                    'deadline' => $assignment->deadline ? Carbon::parse($assignment->deadline)->toDateString() : null,
                ];
            })
            ->values()
            ->all();
    }

    private function summarizeComplianceStatus(Requirement $requirement): string
    {
        if (!$requirement->deadline) {
            return 'N/A';
        }

        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return 'No PIC assigned';
        }

        $total = $assignments->count();
        $statuses = $assignments->map(fn (RequirementAssignment $assignment) => $this->resolveAssignmentStatus($assignment));
        $approved = $statuses->filter(fn (string $status) => $status === 'APPROVED')->count();
        $actuallySubmitted = $statuses->filter(fn (string $status) => $status === 'SUBMITTED')->count();

        if ($approved === $total) {
            return 'Complied (100%)';
        }

        $percent = $total === 0 ? 0 : (int) round(100 * ($approved + $actuallySubmitted) / $total);

        if ($statuses->contains('OVERDUE')) {
            return 'Late (' . $percent . '%)';
        }

        return 'Pending (' . $percent . '%)';
    }

    private function applyComputedAssignmentStatuses(Requirement $requirement): void
    {
        if (!$requirement->relationLoaded('assignments')) {
            return;
        }

        $requirement->assignments->each(function (RequirementAssignment $assignment) {
            $assignment->compliance_status = $this->resolveAssignmentStatus($assignment);
        });
    }

    private function resolveAssignmentStatus(?RequirementAssignment $assignment): string
    {
        if (!$assignment) {
            return 'PENDING';
        }

        $status = strtoupper((string) ($assignment->compliance_status ?: 'PENDING'));
        if (in_array($status, ['APPROVED', 'SUBMITTED'], true)) {
            return $status;
        }

        if ($this->isPastDeadline($assignment->deadline)) {
            return 'OVERDUE';
        }

        return 'PENDING';
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

    private function applyViewerDeadlineContext(Requirement $requirement, ?User $viewer): void
    {
        if (!$viewer || $viewer->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])) {
            return;
        }

        if ($requirement->assignment_mode !== 'parallel') {
            return;
        }

        $assignment = $this->resolveViewerAssignment($requirement, $viewer);

        if ($assignment?->deadline) {
            $requirement->deadline = $assignment->deadline;
        }
    }

    private function resolveViewerAssignment(Requirement $requirement, ?User $viewer): ?RequirementAssignment
    {
        if (!$viewer) {
            return null;
        }

        return $requirement->assignments
            ? $requirement->assignments->firstWhere('assigned_to_user_id', $viewer->id)
            : $requirement->assignments()->where('assigned_to_user_id', $viewer->id)->first();
    }

    private function notifyAssignmentsDeadline($assignments, string $context): void
    {
        $grouped = collect($assignments)->groupBy('requirement_id');
        foreach ($grouped as $requirementId => $group) {
            $requirement = $group->first()?->requirement ?? Requirement::find($requirementId);
            if (!$requirement) {
                continue;
            }
            if ($requirement && $requirement->isSequential()) {
                $active = $requirement->activeSequentialAssignment();
                if ($active) {
                    $this->sendDeadlineNotification($active, $context);
                }
                continue;
            }

            foreach ($group as $assignment) {
                $this->sendDeadlineNotification($assignment, $context);
            }
        }
    }

    private function sendDeadlineNotification(RequirementAssignment $assignment, string $context): void
    {
        $assignment->loadMissing(['user', 'requirement']);
        if (!$assignment->deadline && $context !== 'assigned') {
            return;
        }
        if ($assignment->compliance_status === 'APPROVED') {
            return;
        }
        $pic = $assignment->user;
        if (!$pic || !$pic->email) {
            return;
        }

        try {
            Mail::to($pic->email)->send(new RequirementDeadlineMail($assignment, $context));
        } catch (\Throwable $e) {
            \Log::error('Failed to send requirement deadline email', [
                'assignment_id' => $assignment->id,
                'email' => $pic->email,
                'context' => $context,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
