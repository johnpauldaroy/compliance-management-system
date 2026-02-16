<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return 'CMS Backend is running.';
});

Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::get('/uploads/{upload}/signed-download', [\App\Http\Controllers\UploadController::class, 'signedDownload'])
    ->middleware('signed')
    ->name('uploads.signed-download');
