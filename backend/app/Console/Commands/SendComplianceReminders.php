<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;
use App\Models\RequirementAssignment;
use App\Mail\ComplianceReminderMail;
use App\Mail\ComplianceOverdueMail;

class SendComplianceReminders extends Command
{
    protected $signature = 'compliance:send-reminders';
    protected $description = 'Send compliance reminders to PICs';

    public function handle()
    {
        $offsets = [30, 24, 14, 7];

        foreach ($offsets as $offset) {
            $targetDate = Carbon::today()->addDays($offset);

            $assignments = RequirementAssignment::with(['requirement', 'user'])
                ->whereDate('deadline', $targetDate)
                ->where('compliance_status', '!=', 'APPROVED')
                ->get();

            foreach ($assignments as $assignment) {
                $requirement = $assignment->requirement;
                if ($requirement && $requirement->isSequential()) {
                    $active = $requirement->activeSequentialAssignment();
                    if (!$active || $active->id !== $assignment->id) {
                        continue;
                    }
                }

                $pic = $assignment->user;
                if (!$pic || !$pic->email) {
                    continue;
                }

                try {
                    Mail::to($pic->email)->send(new ComplianceReminderMail($assignment, $offset));
                    $this->info("Reminder (D-{$offset}) sent to {$pic->email} for {$assignment->requirement?->requirement}");
                } catch (\Throwable $e) {
                    \Log::error('Failed to send compliance reminder email', [
                        'assignment_id' => $assignment->id,
                        'email' => $pic->email,
                        'offset_days' => $offset,
                        'error' => $e->getMessage(),
                    ]);
                    $this->error("Reminder (D-{$offset}) failed for {$pic->email}: {$e->getMessage()}");
                }
            }
        }

        $overdueDate = Carbon::today()->subDay();
        $overdueAssignments = RequirementAssignment::with(['requirement', 'user'])
            ->whereDate('deadline', $overdueDate)
            ->where('compliance_status', '!=', 'APPROVED')
            ->get();

        foreach ($overdueAssignments as $assignment) {
            $requirement = $assignment->requirement;
            if ($requirement && $requirement->isSequential()) {
                $active = $requirement->activeSequentialAssignment();
                if (!$active || $active->id !== $assignment->id) {
                    continue;
                }
            }

            $pic = $assignment->user;
            if (!$pic || !$pic->email) {
                continue;
            }

            try {
                Mail::to($pic->email)->send(new ComplianceOverdueMail($assignment));
                $this->info("Overdue (D+1) sent to {$pic->email} for {$assignment->requirement?->requirement}");
            } catch (\Throwable $e) {
                \Log::error('Failed to send overdue compliance email', [
                    'assignment_id' => $assignment->id,
                    'email' => $pic->email,
                    'error' => $e->getMessage(),
                ]);
                $this->error("Overdue (D+1) failed for {$pic->email}: {$e->getMessage()}");
            }
        }

        // Compliance status is computed dynamically; no stored updates needed.
    }
}
