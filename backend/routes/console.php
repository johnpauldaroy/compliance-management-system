<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('compliance:send-reminders')->dailyAt('08:00');
Schedule::command('backup:google-drive')
    ->dailyAt('00:00')
    ->when(fn () => filled(config('backups.google_drive.path')));
Schedule::command('requirements:roll-monthly-deadlines')->dailyAt('00:05');
