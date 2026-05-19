<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AgencyController;
use App\Http\Controllers\BranchUnitDepartmentController;
use App\Http\Controllers\RequirementController;
use App\Http\Controllers\RequirementImportController;
use App\Http\Controllers\UploadSubmissionController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/activity', [DashboardController::class, 'activity']);
    Route::get('/dashboard/agency-stats', [DashboardController::class, 'complianceByAgency']);
    Route::get('/dashboard/calendar', [DashboardController::class, 'calendar']);

    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::post('/users/import', [UserController::class, 'import']);
    Route::get('/users/{user}/details', [UserController::class, 'details']);
    Route::put('/users/{user}', [UserController::class, 'update']);
    Route::put('/users/{user}/password', [UserController::class, 'resetPassword']);

    Route::apiResource('agencies', AgencyController::class);
    Route::apiResource('branch-unit-departments', BranchUnitDepartmentController::class);
    Route::get('/requirements/my', [RequirementController::class, 'myRequirements']);
    Route::get('/requirements/my/history', [RequirementController::class, 'myRequirementHistory']);
    Route::get('/requirements/export', [RequirementController::class, 'export']);
    Route::patch('/requirements/{requirement}/deactivate', [RequirementController::class, 'deactivate']);
    Route::patch('/requirements/{requirement}/reactivate', [RequirementController::class, 'reactivate']);
    Route::apiResource('requirements', RequirementController::class);
    Route::post('/requirements/import', [RequirementImportController::class, 'import']);
    Route::apiResource('submissions', UploadSubmissionController::class)->only(['index', 'store']);
    Route::get('/submissions/{submission}/files/{upload}/download', [UploadSubmissionController::class, 'fileDownload']);
    Route::get('/submissions/{submission}/files/{upload}/signed-url', [UploadSubmissionController::class, 'fileSignedUrl']);
    Route::patch('/submissions/{submission}/submitted-deadline', [UploadSubmissionController::class, 'updateSubmittedDeadline']);
    Route::post('/submissions/{submission}/approve', [UploadSubmissionController::class, 'approve']);
    Route::post('/submissions/{submission}/reject', [UploadSubmissionController::class, 'reject']);
    Route::apiResource('positions', PositionController::class);

    Route::get('/audit-logs', [AuditLogController::class, 'index']);
});
