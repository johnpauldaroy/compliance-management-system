<?php

namespace App\Http\Controllers;

use App\Services\ComplianceReportService;
use Illuminate\Http\Request;

class ComplianceReportController extends Controller
{
    public function __construct(private ComplianceReportService $reportService)
    {
    }

    public function compliance(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'agency_id' => ['nullable', 'integer', 'exists:agencies,id'],
            'branch_unit_department_id' => ['nullable', 'integer', 'exists:branch_unit_departments,id'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'branch' => ['nullable', 'string', 'max:255'],
            'frequency' => ['nullable', 'string', 'max:255'],
            'status' => [
                'nullable',
                'string',
                'in:complied_on_time,complied_late,pending_approval,pending_submission,overdue,rejected',
            ],
        ]);

        return response()->json($this->reportService->generate($validated));
    }
}
