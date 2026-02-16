<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AgencyController;
use App\Http\Controllers\BranchUnitDepartmentController;
use App\Http\Controllers\RequirementController;
use App\Http\Controllers\RequirementImportController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/activity', [DashboardController::class, 'activity']);
    Route::get('/dashboard/agency-stats', [DashboardController::class, 'complianceByAgency']);

    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::put('/users/{user}/password', [UserController::class, 'resetPassword']);

    Route::apiResource('agencies', AgencyController::class);
    Route::apiResource('branch-unit-departments', BranchUnitDepartmentController::class);
    Route::get('/requirements/my', [RequirementController::class, 'myRequirements']);
    Route::get('/requirements/export', [RequirementController::class, 'export']);
    Route::apiResource('requirements', RequirementController::class);
    Route::post('/requirements/import', [RequirementImportController::class, 'import']);
    Route::apiResource('uploads', UploadController::class);
    Route::get('/uploads/{upload}/download', [UploadController::class, 'download']);
    Route::get('/uploads/{upload}/signed-url', [UploadController::class, 'signedUrl']);
    Route::post('/uploads/{upload}/approve', [UploadController::class, 'approve']);
    Route::post('/uploads/{upload}/reject', [UploadController::class, 'reject']);
    Route::apiResource('positions', PositionController::class);

    Route::get('/audit-logs', [AuditLogController::class, 'index']);
});
