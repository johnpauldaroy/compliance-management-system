<?php

namespace App\Http\Controllers;

use App\Models\BranchUnitDepartment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BranchUnitDepartmentController extends Controller
{
    public function index()
    {
        return response()->json(BranchUnitDepartment::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:branch_unit_departments,name',
        ]);

        $department = BranchUnitDepartment::create($validated);
        return response()->json($department, 201);
    }

    public function update(Request $request, BranchUnitDepartment $branchUnitDepartment)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('branch_unit_departments', 'name')->ignore($branchUnitDepartment->id),
            ],
        ]);

        $branchUnitDepartment->update($validated);
        return response()->json($branchUnitDepartment);
    }

    public function destroy(BranchUnitDepartment $branchUnitDepartment)
    {
        $branchUnitDepartment->delete();
        return response()->noContent();
    }
}
