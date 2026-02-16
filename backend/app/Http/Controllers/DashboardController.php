<?php

namespace App\Http\Controllers;

use App\Models\Requirement;
use App\Models\RequirementAssignment;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function stats()
    {
        $totalRequirements = Requirement::count();
        $totalAssignments = RequirementAssignment::count();

        $compliantCount = RequirementAssignment::where('compliance_status', 'APPROVED')->count();
        $pendingCount = RequirementAssignment::whereIn('compliance_status', ['PENDING', 'SUBMITTED', 'REJECTED'])->count();

        $today = Carbon::today();
        $overdueCount = RequirementAssignment::where('compliance_status', '!=', 'APPROVED')
            ->where('deadline', '<', $today)
            ->count();

        $complianceRate = $totalAssignments > 0
            ? round(($compliantCount / $totalAssignments) * 100, 1)
            : 0;

        return response()->json([
            'total_requirements' => $totalRequirements,
            'compliant' => $compliantCount,
            'pending' => $pendingCount,
            'overdue' => $overdueCount,
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
        $stats = \App\Models\Agency::with(['requirements.assignments'])
            ->get()
            ->map(function ($agency) {
                $assignments = $agency->requirements->flatMap->assignments;
                $total = $assignments->count();
                $compliant = $assignments->where('compliance_status', 'APPROVED')->count();

                return [
                    'agency' => $agency->agency_id,
                    'name' => $agency->name,
                    'rate' => $total > 0 ? round(($compliant / $total) * 100, 1) : 0,
                    'total' => $total,
                ];
            });

        return response()->json($stats);
    }
}
