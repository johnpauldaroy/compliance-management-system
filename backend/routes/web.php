<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return 'CMS Backend is running.';
});

Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

Route::get('/uploads/{upload}/signed-download', [\App\Http\Controllers\UploadController::class, 'signedDownload'])
    ->middleware('signed')
    ->name('uploads.signed-download');
