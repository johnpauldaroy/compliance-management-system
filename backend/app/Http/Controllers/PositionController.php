<?php

namespace App\Http\Controllers;

use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PositionController extends Controller
{
    public function index()
    {
        return response()->json(Position::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:positions,name',
        ]);

        $position = Position::create($validated);
        return response()->json($position, 201);
    }

    public function update(Request $request, Position $position)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('positions', 'name')->ignore($position->id),
            ],
        ]);

        $position->update($validated);
        return response()->json($position);
    }

    public function destroy(Position $position)
    {
        $position->delete();
        return response()->noContent();
    }
}
