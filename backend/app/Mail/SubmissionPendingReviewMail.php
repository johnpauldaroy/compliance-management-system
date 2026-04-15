<?php

namespace App\Mail;

use App\Models\Upload;
use App\Models\UploadSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SubmissionPendingReviewMail extends Mailable
{
    use Queueable, SerializesModels;

    public Upload|UploadSubmission $submission;

    public function __construct(Upload|UploadSubmission $submission)
    {
        $relations = ['requirement', 'assignment.user', 'uploader'];
        if ($submission instanceof UploadSubmission) {
            $relations[] = 'files';
        }

        $this->submission = $submission->loadMissing($relations);
    }

    public function build()
    {
        return $this->from(config('mail.from.address'), config('mail.from.name'))
            ->subject('Submission pending review')
            ->view('emails.submission_pending_review');
    }
}
