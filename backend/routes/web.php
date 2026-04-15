<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return 'CMS Backend is running.';
});

Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

Route::get('/submissions/{submission}/files/{upload}/signed-download', [\App\Http\Controllers\UploadSubmissionController::class, 'fileSignedDownload'])
    ->middleware('signed')
    ->name('submissions.files.signed-download');
