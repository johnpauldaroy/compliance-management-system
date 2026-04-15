<?php

namespace App\Mail;

use App\Models\RequirementAssignment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class RequirementDeadlineMail extends Mailable
{
    use Queueable, SerializesModels;

    public RequirementAssignment $assignment;
    public string $context;

    public function __construct(RequirementAssignment $assignment, string $context = 'assigned')
    {
        $this->assignment = $assignment->loadMissing(['requirement', 'user']);
        $this->context = $context;
    }

    public function build()
    {
        if ($this->context === 'updated') {
            $subject = 'Compliance deadline updated';
        } elseif ($this->context === 'activated') {
            $subject = 'Compliance requirement now active';
        } else {
            $subject = 'New compliance requirement assigned';
        }

        return $this->from(config('mail.from.address'), config('mail.from.name'))
            ->subject($subject)
            ->view('emails.requirement_deadline');
    }
}
