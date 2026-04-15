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
            $current = Carbon::parse($requirement->deadline)->startOfDay();
            $next = $current->copy();
            while ($next->lessThanOrEqualTo($today)) {
                $next->addMonthNoOverflow();
            }

            if ($next->equalTo($current)) {
                continue;
            }

            if ($requirement->assignments->isEmpty()
                || $requirement->assignments->contains(fn ($assignment) => $assignment->compliance_status !== 'APPROVED')) {
                continue;
            }

            $lastApprovedAt = $requirement->assignments->max('last_approved_at');
            if (!$lastApprovedAt) {
                continue;
            }
            $eligibleAt = Carbon::parse($lastApprovedAt)->addDays(2)->startOfDay();
            if ($today->lt($eligibleAt)) {
                continue;
            }

            $this->line(sprintf(
                '%s (%s): %s -> %s',
                $requirement->req_id,
                $requirement->requirement,
                $current->toDateString(),
                $next->toDateString()
            ));

            if ($dryRun) {
                continue;
            }

            $requirement->update(['deadline' => $next->toDateString()]);

            $requirement->assignments()->update([
                'deadline' => $next->toDateString(),
                'compliance_status' => 'PENDING',
                'last_submitted_at' => null,
                'last_approved_at' => null,
            ]);

            $requirement->load('assignments.user');
            if ($requirement->isSequential()) {
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
                continue;
            }

            foreach ($requirement->assignments as $assignment) {
                if ($assignment->compliance_status === 'APPROVED') {
                    continue;
                }
                $pic = $assignment->user;
                if (!$pic || !$pic->email) {
                    continue;
                }
                try {
                    Mail::to($pic->email)->send(new RequirementDeadlineMail($assignment, 'updated'));
                } catch (\Throwable $e) {
                    \Log::error('Failed to send monthly deadline update email', [
                        'assignment_id' => $assignment->id,
                        'email' => $pic->email,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return Command::SUCCESS;
    }
}
