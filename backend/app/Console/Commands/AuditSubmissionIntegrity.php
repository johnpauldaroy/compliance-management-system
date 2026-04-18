<?php

namespace App\Console\Commands;

use App\Models\UploadSubmission;
use Illuminate\Console\Command;

class AuditSubmissionIntegrity extends Command
{
    protected $signature = 'requirements:audit-submissions {--id= : Specific upload_submissions.id to inspect} {--limit=50 : Max rows to print when no id is given}';
    protected $description = 'Audit submission rows for missing uploader, assignment, or file links';

    public function handle(): int
    {
        $id = $this->option('id');
        $limit = max(1, (int) $this->option('limit'));

        $query = UploadSubmission::with(['uploader', 'assignment.user', 'files'])
            ->orderByDesc('id');

        if ($id) {
            $query->where('id', (int) $id);
        } else {
            $query->where(function ($q) {
                $q->doesntHave('files')
                    ->orWhereDoesntHave('uploader')
                    ->orWhere(function ($subQ) {
                        $subQ->whereNull('assignment_id')
                            ->whereNull('uploader_email');
                    });
            })->limit($limit);
        }

        $rows = $query->get();
        if ($rows->isEmpty()) {
            $this->info('No matching problematic submissions found.');
            return self::SUCCESS;
        }

        foreach ($rows as $submission) {
            $this->line(str_repeat('-', 80));
            $this->line('DB row id: ' . $submission->id);
            $this->line('Submission label: ' . ($submission->submission_id ?: 'missing'));
            $this->line('Requirement ID: ' . ($submission->requirement_id ?: 'missing'));
            $this->line('Assignment ID: ' . ($submission->assignment_id ?: 'missing'));
            $this->line('Assignment PIC: ' . ($submission->assignment?->user?->employee_name ?: $submission->assignment?->user?->email ?: 'missing'));
            $this->line('Uploaded By User ID: ' . ($submission->uploaded_by_user_id ?: 'missing'));
            $this->line('Resolved uploader: ' . ($submission->uploader?->employee_name ?: $submission->uploader?->email ?: 'missing'));
            $this->line('Uploader email field: ' . ($submission->uploader_email ?: 'missing'));
            $this->line('Deadline at upload: ' . ($submission->deadline_at_upload?->toDateString() ?: 'missing'));
            $this->line('Approval status: ' . ($submission->approval_status ?: 'missing'));
            $this->line('Linked files: ' . $submission->files->count());

            foreach ($submission->files as $file) {
                $this->line('  File #' . $file->id
                    . ' path=' . ($file->doc_file ?: 'missing')
                    . ' upload_user_id=' . ($file->uploaded_by_user_id ?: 'missing')
                    . ' uploader_email=' . ($file->uploader_email ?: 'missing')
                    . ' assignment_id=' . ($file->assignment_id ?: 'missing'));
            }
        }

        $this->line(str_repeat('-', 80));
        $this->info('Audit complete.');

        return self::SUCCESS;
    }
}
