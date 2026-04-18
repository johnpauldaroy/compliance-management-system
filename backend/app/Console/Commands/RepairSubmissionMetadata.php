<?php

namespace App\Console\Commands;

use App\Models\UploadSubmission;
use Illuminate\Console\Command;

class RepairSubmissionMetadata extends Command
{
    protected $signature = 'requirements:repair-submission-metadata {--dry-run : Show changes without writing}';
    protected $description = 'Backfill missing upload submission metadata from linked file records';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $checked = 0;
        $updated = 0;

        UploadSubmission::with(['files'])
            ->chunkById(200, function ($submissions) use (&$checked, &$updated, $dryRun) {
                foreach ($submissions as $submission) {
                    $checked++;
                    $firstFile = $submission->files->first();
                    if (!$firstFile) {
                        continue;
                    }

                    $payload = [];

                    if (!$submission->submission_id) {
                        $payload['submission_id'] = 'SUB-' . strtoupper(substr(md5((string) $submission->id), 0, 12));
                    }

                    if (!$submission->assignment_id && $firstFile->assignment_id) {
                        $payload['assignment_id'] = $firstFile->assignment_id;
                    }

                    if ((!$submission->uploaded_by_user_id || (int) $submission->uploaded_by_user_id <= 0) && $firstFile->uploaded_by_user_id) {
                        $payload['uploaded_by_user_id'] = $firstFile->uploaded_by_user_id;
                    }

                    if (!$submission->uploader_email && $firstFile->uploader_email) {
                        $payload['uploader_email'] = $firstFile->uploader_email;
                    }

                    if (!$submission->deadline_at_upload && $firstFile->deadline_at_upload) {
                        $payload['deadline_at_upload'] = $firstFile->deadline_at_upload;
                    }

                    if (empty($payload)) {
                        continue;
                    }

                    $updated++;
                    $this->line(sprintf(
                        'Submission %d (%s) -> %s',
                        $submission->id,
                        $submission->submission_id ?: 'missing-id',
                        json_encode($payload, JSON_UNESCAPED_SLASHES)
                    ));

                    if (!$dryRun) {
                        $submission->update($payload);
                    }
                }
            });

        $summary = $dryRun ? 'Would update' : 'Updated';
        $this->info(sprintf('%s %d submission(s) after checking %d.', $summary, $updated, $checked));

        return self::SUCCESS;
    }
}
