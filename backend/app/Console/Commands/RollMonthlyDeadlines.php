<?php

namespace App\Console\Commands;

use App\Mail\RequirementDeadlineMail;
use App\Models\Requirement;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class RollMonthlyDeadlines extends Command
{
    protected $signature = 'requirements:roll-monthly-deadlines {--dry-run : Show changes without writing}';
    protected $description = 'Advance monthly requirement deadlines when due, and notify PICs';

    public function handle(): int
    {
        $today = Carbon::today();
        $dryRun = (bool) $this->option('dry-run');

        $requirements = Requirement::with(['assignments.user'])
            ->whereNotNull('deadline')
            ->where('auto_deadline_enabled', true)
            ->whereRaw('LOWER(frequency) LIKE ?', ['%month%'])
            ->whereDate('deadline', '<=', $today)
            ->get();

        if ($requirements->isEmpty()) {
            $this->info('No monthly deadlines to roll.');
            return Command::SUCCESS;
        }

        foreach ($requirements as $requirement) {
            if ($requirement->isSequential()) {
                $this->rollSharedRequirementDeadline($requirement, $today, $dryRun);
                continue;
            }

            $this->rollParallelAssignmentDeadlines($requirement, $today, $dryRun);
        }

        return Command::SUCCESS;
    }

    private function rollSharedRequirementDeadline(Requirement $requirement, Carbon $today, bool $dryRun): void
    {
        if ($requirement->assignments->isEmpty()
            || $requirement->assignments->contains(fn ($assignment) => $assignment->compliance_status !== 'APPROVED')) {
            return;
        }

        $lastApprovedAt = $requirement->assignments->max('last_approved_at');
        if (!$lastApprovedAt) {
            return;
        }
        $eligibleAt = Carbon::parse($lastApprovedAt)->addDays(2)->startOfDay();
        if ($today->lt($eligibleAt)) {
            return;
        }

        $current = Carbon::parse($requirement->deadline)->startOfDay();
        $nextDeadlines = [];
        foreach ($requirement->assignments as $assignment) {
            if (!$assignment->deadline) {
                return;
            }

            $currentAssignmentDeadline = Carbon::parse($assignment->deadline)->startOfDay();
            $nextAssignmentDeadline = $currentAssignmentDeadline->copy();
            while ($nextAssignmentDeadline->lessThanOrEqualTo($today)) {
                $nextAssignmentDeadline->addMonthNoOverflow();
            }

            $nextDeadlines[$assignment->id] = $nextAssignmentDeadline->toDateString();
        }

        $next = Carbon::parse(end($nextDeadlines))->startOfDay();
        if ($next->equalTo($current)) {
            return;
        }

        $this->line(sprintf(
            '%s (%s): %s -> %s',
            $requirement->req_id,
            $requirement->requirement,
            $current->toDateString(),
            $next->toDateString()
        ));

        if ($dryRun) {
            return;
        }

        $requirement->update(['deadline' => $next->toDateString()]);

        foreach ($requirement->assignments as $assignment) {
            $assignment->update([
                'deadline' => $nextDeadlines[$assignment->id] ?? $assignment->deadline,
                'compliance_status' => 'PENDING',
                'last_submitted_at' => null,
                'last_approved_at' => null,
            ]);
        }

        $requirement->load('assignments.user');
        $active = $requirement->activeSequentialAssignment();
        if ($active && $active->user && $active->user->email) {
            try {
                Mail::to($active->user->email)->send(new RequirementDeadlineMail($active, 'updated'));
            } catch (\Throwable $e) {
                \Log::error('Failed to send monthly deadline update email', [
                    'assignment_id' => $active->id,
                    'email' => $active->user->email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function rollParallelAssignmentDeadlines(Requirement $requirement, Carbon $today, bool $dryRun): void
    {
        foreach ($requirement->assignments as $assignment) {
            if ($assignment->compliance_status !== 'APPROVED' || !$assignment->deadline) {
                continue;
            }

            $lastApprovedAt = $assignment->last_approved_at;
            if (!$lastApprovedAt) {
                continue;
            }

            $eligibleAt = Carbon::parse($lastApprovedAt)->addDays(2)->startOfDay();
            if ($today->lt($eligibleAt)) {
                continue;
            }

            $current = Carbon::parse($assignment->deadline)->startOfDay();
            if ($current->greaterThan($today)) {
                continue;
            }

            $next = $current->copy();
            while ($next->lessThanOrEqualTo($today)) {
                $next->addMonthNoOverflow();
            }

            if ($next->equalTo($current)) {
                continue;
            }

            $picName = $assignment->user?->employee_name ?: $assignment->user?->email ?: ('PIC #' . $assignment->assigned_to_user_id);
            $this->line(sprintf(
                '%s (%s) [%s]: %s -> %s',
                $requirement->req_id,
                $requirement->requirement,
                $picName,
                $current->toDateString(),
                $next->toDateString()
            ));

            if ($dryRun) {
                continue;
            }

            $assignment->update([
                'deadline' => $next->toDateString(),
                'compliance_status' => 'PENDING',
                'last_submitted_at' => null,
                'last_approved_at' => null,
            ]);

            $this->sendDeadlineUpdate($assignment);
        }
    }

    private function sendDeadlineUpdate($assignment): void
    {
        $assignment->loadMissing(['user', 'requirement']);
        if (!$assignment->user?->email) {
            return;
        }

        try {
            Mail::to($assignment->user->email)->send(new RequirementDeadlineMail($assignment, 'updated'));
        } catch (\Throwable $e) {
            \Log::error('Failed to send monthly deadline update email', [
                'assignment_id' => $assignment->id,
                'email' => $assignment->user->email,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
