<?php

namespace App\Http\Controllers;

use App\Models\Agency;
use Illuminate\Http\Request;

class AgencyController extends Controller
{
    public function index()
    {
        return response()->json(Agency::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'agency_id' => 'required|unique:agencies',
            'name' => 'required|string',
        ]);

        $validated['agency_id'] = strtoupper($validated['agency_id']);
        $agency = Agency::create($validated);
        return response()->json($agency, 211);
    }

    public function show(Agency $agency)
    {
        return response()->json($agency->load('requirements'));
    }

    public function update(Request $request, Agency $agency)
    {
        $validated = $request->validate([
            'name' => 'required|string',
        ]);

        $agency->update($validated);
        return response()->json($agency);
    }

    public function destroy(Agency $agency)
    {
        $agency->delete();
        return response()->noContent();
    }
}
