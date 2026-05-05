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
    private array $assignmentStateCache = [];

    public function index(Request $request)
    {
        $this->authorize('viewAny', Requirement::class);
        $perPage = (int) $request->query('per_page', 25);
        $perPage = $perPage > 0 ? min($perPage, 200) : 25;
        $today = Carbon::today()->toDateString();
        $summary = $request->boolean('summary');

        $query = Requirement::with($summary ? [
            'agency',
            'assignments.user',
        ] : [
            'agency',
            'assignments.user',
            'submissions' => function ($submissionQuery) {
                $submissionQuery->select([
                    'id',
                    'requirement_id',
                    'assignment_id',
                    'uploaded_by_user_id',
                    'upload_date',
                    'deadline_at_upload',
                    'approval_status',
                    'status_change_on',
                    'created_at',
                ]);
            },
        ]);

        $activeStatus = strtolower((string) $request->query('active_status', 'active'));
        if ($activeStatus === 'inactive') {
            $query->inactive();
        } elseif ($activeStatus !== 'all') {
            $query->active();
        }

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
                        $this->whereAssignmentIsNotComputedApproved($assignmentQuery);
                    });
            } elseif ($status === 'overdue') {
                $query->whereNotNull('deadline')
                    ->whereHas('assignments', function ($assignmentQuery) use ($today) {
                        $this->whereAssignmentIsComputedOverdue($assignmentQuery, $today);
                    });
            } elseif ($status === 'pending') {
                $query->whereNotNull('deadline')
                    ->where(function ($statusQuery) use ($today) {
                        $statusQuery->whereDoesntHave('assignments')
                            ->orWhere(function ($subQuery) use ($today) {
                                $subQuery->whereHas('assignments', function ($assignmentQuery) {
                                    $this->whereAssignmentIsNotComputedApproved($assignmentQuery);
                                })->whereDoesntHave('assignments', function ($assignmentQuery) use ($today) {
                                    $this->whereAssignmentIsComputedOverdue($assignmentQuery, $today);
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
        $page->getCollection()->each(function ($requirement) use ($summary) {
            $requirement->compliance_status = $summary
                ? $this->summarizeStoredComplianceStatus($requirement)
                : $this->summarizeComplianceStatus($requirement);
        });

        return response()->json($page);
    }

    public function myRequirements()
    {
        $user = Auth::user();
        $userId = $user->id;

        $requirements = Requirement::active()->with([
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
            $requirement->compliance_status = $assignment
                ? $this->buildAssignmentState($requirement, $assignment)['status']
                : 'PENDING';
            $this->applyViewerDeadlineContext($requirement, $user);
        });

        return response()->json($requirements);
    }

    public function myRequirementHistory()
    {
        $user = Auth::user();
        $userId = $user->id;

        $requirements = Requirement::with([
            'agency',
            'allAssignments' => function ($query) use ($userId) {
                $query->where('assigned_to_user_id', $userId);
            },
            'allAssignments.user',
            'submissions' => function ($query) use ($userId) {
                $query->where(function ($submissionQuery) use ($userId) {
                    $submissionQuery->where('uploaded_by_user_id', $userId)
                        ->orWhereHas('assignment', function ($assignmentQuery) use ($userId) {
                            $assignmentQuery->where('assigned_to_user_id', $userId);
                        });
                })->orderByDesc('upload_date');
            },
            'submissions.files',
            'submissions.uploader',
            'submissions.assignment.user',
        ])->where(function ($query) use ($userId) {
            $query->whereHas('allAssignments', function ($assignmentQuery) use ($userId) {
                $assignmentQuery->removed()
                    ->where('assigned_to_user_id', $userId);
            })->orWhereHas('submissions', function ($submissionQuery) use ($userId) {
                $submissionQuery->where('uploaded_by_user_id', $userId)
                    ->orWhereHas('assignment', function ($assignmentQuery) use ($userId) {
                        $assignmentQuery->where('assigned_to_user_id', $userId);
                    });
            });
        })->whereDoesntHave('assignments', function ($assignmentQuery) use ($userId) {
            $assignmentQuery->where('assigned_to_user_id', $userId);
        })->orderBy('req_id')->get();

        $requirements->each(function ($requirement) {
            $requirement->setRelation('assignments', $requirement->allAssignments);
            $requirement->compliance_status = 'HISTORY';
        });

        return response()->json($requirements);
    }

    public function export(Request $request)
    {
        $this->authorize('viewAny', Requirement::class);
        $query = Requirement::with([
            'agency',
            'assignments.user',
            'submissions' => function ($submissionQuery) {
                $submissionQuery->select([
                    'id',
                    'requirement_id',
                    'assignment_id',
                    'uploaded_by_user_id',
                    'upload_date',
                    'deadline_at_upload',
                    'approval_status',
                    'status_change_on',
                    'created_at',
                ]);
            },
        ]);

        $activeStatus = strtolower((string) $request->query('active_status', 'active'));
        if ($activeStatus === 'inactive') {
            $query->inactive();
        } elseif ($activeStatus !== 'all') {
            $query->active();
        }

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
            'deadline' => 'nullable|date',
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
            'submissions' => function ($query) {
                $query->select([
                    'id',
                    'submission_id',
                    'requirement_id',
                    'assignment_id',
                    'uploaded_by_user_id',
                    'uploader_email',
                    'upload_date',
                    'deadline_at_upload',
                    'comments',
                    'approval_status',
                    'status_change_on',
                    'admin_remarks',
                    'upload_year',
                    'created_at',
                    'updated_at',
                ])->orderByDesc('upload_date');
            },
            'submissions.files',
            'submissions.uploader',
            'submissions.assignment.user',
        ]);
        $this->applyComputedAssignmentStatuses($requirement);
        $viewerAssignment = $this->resolveViewerAssignment($requirement, $viewer);
        $this->applyViewerDeadlineContext($requirement, $viewer);
        $requirement->compliance_status = $viewerAssignment && !$viewer?->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])
            ? $this->buildAssignmentState($requirement, $viewerAssignment)['status']
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
            'deadline' => 'nullable|date',
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
                    $hasPendingAssignments = $requirement->assignments()
                        ->whereIn('assigned_to_user_id', $toRemove)
                        ->whereHas('submissions', function ($submissionQuery) {
                            $submissionQuery->where('approval_status', 'PENDING');
                        })
                        ->exists();

                    if ($hasPendingAssignments) {
                        throw ValidationException::withMessages([
                            'person_in_charge_user_ids' => ['Cannot remove assigned person-in-charge with pending submissions for approval.'],
                        ]);
                    }
                }
                $requirement->assignments()->whereIn('assigned_to_user_id', $toRemove)->update([
                    'removed_at' => now(),
                    'removed_by_user_id' => Auth::id(),
                    'sequence_order' => null,
                ]);
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
                        $newAssignments[] = $this->createOrReactivateAssignment($requirement, (int) $userId, [
                            'sequence_order' => null,
                            'deadline' => $sequentialDeadlines[$userId] ?? null,
                        ]);
                    }
                }

                foreach ($orderedPicUserIds as $index => $userId) {
                    $assignment = $requirement->assignments()
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
                    $newAssignments[] = $this->createOrReactivateAssignment($requirement, (int) $userId, [
                        'deadline' => $validated['deadline'] ?? $requirement->deadline,
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
        $this->deactivateRequirement($requirement);
        return response()->json($requirement->fresh());
    }

    public function deactivate(Requirement $requirement)
    {
        $this->authorize('delete', $requirement);
        $this->deactivateRequirement($requirement);
        return response()->json($requirement->fresh());
    }

    public function reactivate(Requirement $requirement)
    {
        $this->authorize('update', $requirement);

        if ($requirement->isActive()) {
            return response()->json($requirement);
        }

        $requirement->update([
            'deactivated_at' => null,
            'deactivated_by_user_id' => null,
        ]);

        return response()->json($requirement->fresh());
    }

    private function deactivateRequirement(Requirement $requirement): void
    {
        if (!$requirement->isActive()) {
            return;
        }

        $requirement->update([
            'deactivated_at' => now(),
            'deactivated_by_user_id' => Auth::id(),
        ]);
    }

    private function createOrReactivateAssignment(Requirement $requirement, int $userId, array $overrides = []): RequirementAssignment
    {
        $assignment = $requirement->allAssignments()
            ->where('assigned_to_user_id', $userId)
            ->first();

        $payload = array_merge([
            'removed_at' => null,
            'removed_by_user_id' => null,
            'compliance_status' => 'PENDING',
            'last_submitted_at' => null,
            'last_approved_at' => null,
        ], $overrides);

        if ($assignment) {
            $assignment->update($payload);
            return $assignment->fresh(['user', 'requirement']);
        }

        return RequirementAssignment::create(array_merge([
            'assignment_id' => 'ASGN-' . strtoupper(\Illuminate\Support\Str::random(10)),
            'requirement_id' => $requirement->id,
            'assigned_to_user_id' => $userId,
            'compliance_status' => 'PENDING',
        ], $overrides));
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
        $statuses = $assignments->map(fn (RequirementAssignment $assignment) => $this->buildAssignmentState($requirement, $assignment)['status']);
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

    private function whereAssignmentIsNotComputedApproved($assignmentQuery): void
    {
        $assignmentQuery->where(function ($notApprovedQuery) {
            $this->whereAssignmentHasMatchingSubmissionStatus($notApprovedQuery, ['PENDING']);

            $notApprovedQuery->orWhere(function ($approvalQuery) {
                $approvalQuery->where(function ($statusQuery) {
                    $statusQuery->whereNull('compliance_status')
                        ->orWhere('compliance_status', '!=', 'APPROVED');
                });
                $this->whereAssignmentDoesntHaveMatchingSubmissionStatus($approvalQuery, ['APPROVED']);
            });
        });
    }

    private function whereAssignmentIsComputedOverdue($assignmentQuery, string $today): void
    {
        $assignmentQuery->whereNotNull('deadline')
            ->whereDate('deadline', '<', $today)
            ->where(function ($statusQuery) {
                $statusQuery->whereNull('compliance_status')
                    ->orWhereNotIn('compliance_status', ['APPROVED', 'SUBMITTED']);
            });

        $this->whereAssignmentDoesntHaveMatchingSubmissionStatus($assignmentQuery, ['PENDING']);
        $this->whereAssignmentDoesntHaveMatchingSubmissionStatus($assignmentQuery, ['APPROVED']);
    }

    private function whereAssignmentHasMatchingSubmissionStatus($assignmentQuery, array $statuses): void
    {
        $assignmentQuery->whereExists(function ($submissionQuery) use ($statuses) {
            $this->matchingSubmissionStatusQuery($submissionQuery, $statuses);
        });
    }

    private function whereAssignmentDoesntHaveMatchingSubmissionStatus($assignmentQuery, array $statuses): void
    {
        $assignmentQuery->whereNotExists(function ($submissionQuery) use ($statuses) {
            $this->matchingSubmissionStatusQuery($submissionQuery, $statuses);
        });
    }

    private function matchingSubmissionStatusQuery($submissionQuery, array $statuses): void
    {
        $submissionQuery->select(DB::raw(1))
            ->from('upload_submissions')
            ->whereColumn('upload_submissions.requirement_id', 'requirements.id')
            ->whereIn('upload_submissions.approval_status', $statuses)
            ->whereNotNull('upload_submissions.deadline_at_upload')
            ->whereRaw('DATE(upload_submissions.deadline_at_upload) = DATE(COALESCE(requirement_assignments.deadline, requirements.deadline))')
            ->where(function ($matchQuery) {
                $matchQuery->whereColumn('upload_submissions.assignment_id', 'requirement_assignments.id')
                    ->orWhere(function ($legacyQuery) {
                        $legacyQuery->whereNull('upload_submissions.assignment_id')
                            ->whereColumn('upload_submissions.uploaded_by_user_id', 'requirement_assignments.assigned_to_user_id');
                    })
                    ->orWhere(function ($emailQuery) {
                        $emailQuery->whereNull('upload_submissions.assignment_id')
                            ->whereNotNull('upload_submissions.uploader_email')
                            ->whereExists(function ($userQuery) {
                                $userQuery->select(DB::raw(1))
                                    ->from('users')
                                    ->whereColumn('users.id', 'requirement_assignments.assigned_to_user_id')
                                    ->whereRaw('LOWER(users.email) = LOWER(upload_submissions.uploader_email)');
                            });
                    });
            });
    }

    private function summarizeStoredComplianceStatus(Requirement $requirement): string
    {
        if (!$requirement->deadline) {
            return 'N/A';
        }

        $assignments = $requirement->assignments;
        if ($assignments->isEmpty()) {
            return 'No PIC assigned';
        }

        $total = $assignments->count();
        $statuses = $assignments->map(function (RequirementAssignment $assignment) {
            $status = strtoupper((string) ($assignment->compliance_status ?: 'PENDING'));
            if (!in_array($status, ['APPROVED', 'SUBMITTED'], true) && $this->isPastDeadline($assignment->deadline)) {
                return 'OVERDUE';
            }
            return $status;
        });
        $approved = $statuses->filter(fn (string $status) => $status === 'APPROVED')->count();
        $submitted = $statuses->filter(fn (string $status) => $status === 'SUBMITTED')->count();

        if ($approved === $total) {
            return 'Complied (100%)';
        }

        $percent = (int) round(100 * ($approved + $submitted) / $total);
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

        $requirement->assignments->each(function (RequirementAssignment $assignment) use ($requirement) {
            $state = $this->buildAssignmentState($requirement, $assignment);
            $assignment->compliance_status = $state['status'];
            $assignment->last_submitted_at = $state['last_submitted_at'];
            $assignment->last_approved_at = $state['last_approved_at'];
        });
    }

    private function buildAssignmentState(Requirement $requirement, ?RequirementAssignment $assignment): array
    {
        if (!$assignment) {
            return [
                'status' => 'PENDING',
                'last_submitted_at' => null,
                'last_approved_at' => null,
            ];
        }

        $cacheKey = $requirement->id . ':' . $assignment->id;
        if (array_key_exists($cacheKey, $this->assignmentStateCache)) {
            return $this->assignmentStateCache[$cacheKey];
        }

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
        } elseif (in_array($storedStatus, ['APPROVED', 'SUBMITTED'], true)) {
            $status = $storedStatus;
        } elseif ($this->isPastDeadline($assignment->deadline)) {
            $status = 'OVERDUE';
        } else {
            $status = 'PENDING';
        }

        return $this->assignmentStateCache[$cacheKey] = [
            'status' => $status,
            'last_submitted_at' => $latestSubmission
                ? $this->submissionTimestamp($latestSubmission)
                : $assignment->last_submitted_at,
            'last_approved_at' => $latestApprovedSubmission
                ? $this->submissionApprovedTimestamp($latestApprovedSubmission)
                : $assignment->last_approved_at,
        ];
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

    private function matchAssignmentSubmissions(Requirement $requirement, RequirementAssignment $assignment)
    {
        $deadlineKey = $assignment->deadline
            ? Carbon::parse($assignment->deadline)->toDateString()
            : ($requirement->deadline ? Carbon::parse($requirement->deadline)->toDateString() : null);
        if (!$deadlineKey) {
            return collect();
        }

        $submissions = $requirement->relationLoaded('submissions')
            ? $requirement->submissions
            : ($assignment->relationLoaded('submissions')
                ? $assignment->submissions
                : $assignment->submissions()->get());

        return $submissions->filter(function ($submission) use ($assignment, $deadlineKey) {
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

            if ((int) $submission->uploaded_by_user_id === (int) $assignment->assigned_to_user_id) {
                return true;
            }

            $assignmentEmail = strtolower((string) ($assignment->user?->email ?? ''));
            $uploaderEmail = strtolower((string) ($submission->uploader_email ?? ''));

            return $assignmentEmail !== '' && $uploaderEmail !== '' && $assignmentEmail === $uploaderEmail;
        })->values();
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
            if (!$requirement || !$requirement->isActive()) {
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
        if (!$assignment->requirement?->isActive()) {
            return;
        }
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
