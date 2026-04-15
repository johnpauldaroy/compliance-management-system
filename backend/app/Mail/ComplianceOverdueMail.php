<?php

namespace App\Mail;

use App\Models\RequirementAssignment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ComplianceOverdueMail extends Mailable
{
    use Queueable, SerializesModels;

    public RequirementAssignment $assignment;

    public function __construct(RequirementAssignment $assignment)
    {
        $this->assignment = $assignment->loadMissing(['requirement', 'user']);
    }

    public function build()
    {
        return $this->from(config('mail.from.address'), config('mail.from.name'))
            ->subject('Compliance overdue reminder (D+1)')
            ->view('emails.compliance_overdue');
    }
}
