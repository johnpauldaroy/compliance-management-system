<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index()
    {
        if (!auth()->user()->hasRole('Super Admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json(AuditLog::with('actor')->orderBy('created_at', 'desc')->get());
    }
}
