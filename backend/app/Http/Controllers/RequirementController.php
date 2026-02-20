<?php

namespace App\Http\Controllers;

use App\Models\Requirement;
use App\Models\Upload;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use App\Mail\RequirementDeadlineMail;
use App\Models\RequirementAssignment;

class RequirementController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Requirement::class);
        $perPage = (int) $request->query('per_page', 25);
        $perPage = $perPage > 0 ? min($perPage, 200) : 25;

        $query = Requirement::with(['agency', 'assignments.user', 'assignments.uploads']);

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
                    ->whereHas('assignments', function ($assignmentQuery) {
                        $assignmentQuery->where('compliance_status', 'OVERDUE');
                    });
            } elseif ($status === 'pending') {
                $query->whereNotNull('deadline')
                    ->where(function ($statusQuery) {
                        $statusQuery->whereDoesntHave('assignments')
                            ->orWhere(function ($subQuery) {
                                $subQuery->whereHas('assignments', function ($assignmentQuery) {
                                    $assignmentQuery->where('compliance_status', '!=', 'APPROVED');
                                })->whereDoesntHave('assignments', function ($assignmentQuery) {
                                    $assignmentQuery->where('compliance_status', 'OVERDUE');
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
            }
        ])->where(function ($query) use ($userId) {
            $query->whereHas('assignments', function ($subQuery) use ($userId) {
                $subQuery->where('assigned_to_user_id', $userId);
            })->orWhereRaw("CONCAT(';', person_in_charge_user_ids, ';') LIKE ?", ['%;' . $userId . ';%']);
        })->get();

        $requirements->each(function ($requirement) use ($user) {
            $assignment = $requirement->assignments->first();
            $requirement->compliance_status = $assignment ? $assignment->compliance_status : 'PENDING';
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
            'position_ids' => 'nullable',
            'branch_unit_department_ids' => 'nullable',
            'person_in_charge_user_ids' => 'nullable',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $validated['req_id'] = $this->generateReqId((int) $validated['agency_id']);

            // Still keep the strings for now to maintain frontend compatibility during transition
            $validated['position_ids'] = $this->normalizeIdList($validated['position_ids'] ?? null);
            $validated['branch_unit_department_ids'] = $this->normalizeIdList($validated['branch_unit_department_ids'] ?? null);
            $validated['person_in_charge_user_ids'] = $this->normalizeIdList($validated['person_in_charge_user_ids'] ?? null);

            $requirement = Requirement::create($validated);

            $picUserIds = $this->parseIdList($validated['person_in_charge_user_ids']);
            $assignments = [];
            foreach ($picUserIds as $userId) {
                $assignments[] = RequirementAssignment::create([
                    'assignment_id' => 'ASGN-' . strtoupper(\Illuminate\Support\Str::random(10)),
                    'requirement_id' => $requirement->id,
                    'assigned_to_user_id' => $userId,
                    'deadline' => $requirement->deadline,
                    'compliance_status' => 'PENDING',
                ]);
            }

            $this->notifyAssignmentsDeadline($assignments, 'assigned');

            return response()->json($requirement, 211);
        });
    }

    public function show(Requirement $requirement)
    {
        $this->authorize('view', $requirement);
        $requirement->load(['agency', 'assignments.user', 'assignments.uploads.uploader', 'uploads.uploader']);
        $requirement->compliance_status = $this->summarizeComplianceStatus($requirement);

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
            'position_ids' => 'nullable',
            'branch_unit_department_ids' => 'nullable',
            'person_in_charge_user_ids' => 'nullable',
        ]);

        return DB::transaction(function () use ($validated, $requirement) {
            $originalDeadline = $requirement->deadline;
            $newAssignments = [];
            if (array_key_exists('position_ids', $validated)) {
                $validated['position_ids'] = $this->normalizeIdList($validated['position_ids']);
            }
            if (array_key_exists('branch_unit_department_ids', $validated)) {
                $validated['branch_unit_department_ids'] = $this->normalizeIdList($validated['branch_unit_department_ids']);
            }

            if (array_key_exists('person_in_charge_user_ids', $validated)) {
                $validated['person_in_charge_user_ids'] = $this->normalizeIdList($validated['person_in_charge_user_ids']);
                $newPicUserIds = $this->parseIdList($validated['person_in_charge_user_ids']);
                $oldPicUserIds = $requirement->assignments()->pluck('assigned_to_user_id')->toArray();

                // Remove assignments no longer in the list
                $toRemove = array_diff($oldPicUserIds, $newPicUserIds);
                $requirement->assignments()->whereIn('assigned_to_user_id', $toRemove)->delete();

                // Add new assignments
                $toAdd = array_diff($newPicUserIds, $oldPicUserIds);
                foreach ($toAdd as $userId) {
                    $newAssignments[] = RequirementAssignment::create([
                        'assignment_id' => 'ASGN-' . strtoupper(\Illuminate\Support\Str::random(10)),
                        'requirement_id' => $requirement->id,
                        'assigned_to_user_id' => $userId,
                        'deadline' => $validated['deadline'] ?? $requirement->deadline,
                        'compliance_status' => 'PENDING',
                    ]);
                }
            }

            // Sync deadlines for all assignments if changed
            if (isset($validated['deadline'])) {
                $requirement->assignments()->update(['deadline' => $validated['deadline']]);
            }

            $requirement->update($validated);

            $deadlineChanged = array_key_exists('deadline', $validated)
                && $validated['deadline']
                && $validated['deadline'] !== $originalDeadline;

            if ($deadlineChanged) {
                $requirement->assignments()->update([
                    'compliance_status' => 'PENDING',
                    'last_submitted_at' => null,
                    'last_approved_at' => null,
                ]);
            }

            if ($deadlineChanged) {
                $allAssignments = $requirement->assignments()->with('user', 'requirement')->get();
                $this->notifyAssignmentsDeadline($allAssignments, 'updated');
            } elseif (!empty($newAssignments)) {
                $this->notifyAssignmentsDeadline($newAssignments, 'assigned');
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

    private function parseIdList(?string $value): array
    {
        if (!$value) {
            return [];
        }

        $parts = preg_split('/\s*;\s*/', $value);
        return array_values(array_filter(array_map('intval', $parts)));
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
        $approved = $assignments->where('compliance_status', 'APPROVED')->count();
        $submitted = $assignments->whereIn('compliance_status', ['SUBMITTED', 'REJECTED', 'PENDING'])->count(); // Simplified for now

        // Count actually submitted but not approved
        $actuallySubmitted = $assignments->where('compliance_status', 'SUBMITTED')->count();

        if ($approved === $total) {
            return 'Complied (100%)';
        }

        $percent = $total === 0 ? 0 : (int) round(100 * ($approved + $actuallySubmitted) / $total);

        // Check if any is overdue
        $hasOverdue = $assignments->where('compliance_status', 'OVERDUE')->count() > 0;
        if ($actuallySubmitted === 0 && $approved === 0 && $hasOverdue) {
            return 'Late (100%)';
        }

        return 'Pending (' . $percent . '%)';
    }

    private function notifyAssignmentsDeadline($assignments, string $context): void
    {
        foreach ($assignments as $assignment) {
            $assignment->loadMissing(['user', 'requirement']);
            if (!$assignment->deadline && $context !== 'assigned') {
                continue;
            }
            if ($assignment->compliance_status === 'APPROVED') {
                continue;
            }
            $pic = $assignment->user;
            if (!$pic || !$pic->email) {
                continue;
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
}
