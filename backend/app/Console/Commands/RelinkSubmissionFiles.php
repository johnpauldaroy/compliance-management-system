<?php

namespace App\Console\Commands;

use App\Models\Upload;
use App\Models\UploadSubmission;
use Carbon\Carbon;
use Illuminate\Console\Command;

class RelinkSubmissionFiles extends Command
{
    protected $signature = 'requirements:relink-submission-files {--dry-run : Show changes without writing}';
    protected $description = 'Relink orphaned upload files to the most likely upload submission';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $checked = 0;
        $updated = 0;

        Upload::with('submission')
            ->orderBy('id')
            ->chunkById(200, function ($uploads) use (&$checked, &$updated, $dryRun) {
                foreach ($uploads as $upload) {
                    $checked++;

                    if ($upload->submission) {
                        continue;
                    }

                    $candidate = $this->findBestSubmissionMatch($upload);
                    if (!$candidate) {
                        continue;
                    }

                    $updated++;
                    $this->line(sprintf(
                        'Upload %d (%s) -> submission %d (%s)',
                        $upload->id,
                        $upload->upload_id ?: 'no-upload-id',
                        $candidate->id,
                        $candidate->submission_id ?: 'missing-submission-id'
                    ));

                    if (!$dryRun) {
                        $upload->update(['submission_id' => $candidate->id]);
                    }
                }
            });

        $summary = $dryRun ? 'Would relink' : 'Relinked';
        $this->info(sprintf('%s %d upload file(s) after checking %d.', $summary, $updated, $checked));

        return self::SUCCESS;
    }

    private function findBestSubmissionMatch(Upload $upload): ?UploadSubmission
    {
        $query = UploadSubmission::query()
            ->where('requirement_id', $upload->requirement_id)
            ->when($upload->deadline_at_upload, function ($q) use ($upload) {
                $q->whereDate('deadline_at_upload', Carbon::parse($upload->deadline_at_upload)->toDateString());
            })
            ->when($upload->assignment_id, function ($q) use ($upload) {
                $q->where('assignment_id', $upload->assignment_id);
            }, function ($q) use ($upload) {
                if ($upload->uploaded_by_user_id) {
                    $q->where(function ($subQuery) use ($upload) {
                        $subQuery->where('uploaded_by_user_id', $upload->uploaded_by_user_id)
                            ->orWhere('uploader_email', $upload->uploader_email);
                    });
                } elseif ($upload->uploader_email) {
                    $q->where('uploader_email', $upload->uploader_email);
                }
            });

        $candidates = $query->get();
        if ($candidates->isEmpty()) {
            return null;
        }

        $uploadTs = $this->timestamp($upload->upload_date ?? $upload->created_at);

        return $candidates
            ->sortBy(function (UploadSubmission $submission) use ($uploadTs, $upload) {
                $submissionTs = $this->timestamp($submission->upload_date ?? $submission->created_at);
                $timeDistance = ($uploadTs && $submissionTs)
                    ? abs($uploadTs->diffInSeconds($submissionTs, false))
                    : PHP_INT_MAX;

                $statusPenalty = strtoupper((string) $submission->approval_status) === strtoupper((string) $upload->approval_status)
                    ? 0
                    : 1;

                return [$statusPenalty, $timeDistance, $submission->id];
            })
            ->first();
    }

    private function timestamp($value): ?Carbon
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable $e) {
            return null;
        }
    }
}
