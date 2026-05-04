<?php

return [
    'google_drive' => [
        'path' => env('GOOGLE_DRIVE_BACKUP_PATH'),
        'retention_days' => (int) env('GOOGLE_DRIVE_BACKUP_RETENTION_DAYS', 30),
        'include_database' => env('GOOGLE_DRIVE_BACKUP_INCLUDE_DATABASE', false),
        'include_files' => env('GOOGLE_DRIVE_BACKUP_INCLUDE_FILES', true),
        'approved_only' => env('GOOGLE_DRIVE_BACKUP_APPROVED_ONLY', true),
        'folder_url' => env('GOOGLE_DRIVE_BACKUP_FOLDER_URL'),
    ],
];
