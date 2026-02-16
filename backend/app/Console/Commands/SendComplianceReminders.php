<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Requirement;
use App\Models\User;
use App\Models\Upload;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class SendComplianceReminders extends Command
{
    protected $signature = 'compliance:send-reminders';
    protected $description = 'Send compliance reminders to PICs';

    public function handle()
    {
        $offsets = [30, 14, 7, 1];

        foreach ($offsets as $offset) {
            $targetDate = Carbon::today()->addDays($offset);

            $requirements = Requirement::whereDate('deadline', $targetDate)->get();
            $requirements = $this->filterOutComplied($requirements);

            foreach ($requirements as $requirement) {
                $picIds = array_filter(array_map('intval', preg_split('/\s*;\s*/', (string) $requirement->person_in_charge_user_ids)));
                if (!$picIds) {
                    continue;
                }
                $pics = User::whereIn('id', $picIds)->get();

                foreach ($pics as $pic) {
                    // Here we would send the email
                    // Mail::to($pic->email)->send(new ComplianceReminderMail($requirement));
                    $this->info("Reminder (D-{$offset}) sent to {$pic->email} for {$requirement->requirement}");
                }
            }
        }

        // Compliance status is computed dynamically; no stored updates needed.
    }

    private function filterOutComplied(Collection $requirements): Collection
    {
        if ($requirements->isEmpty()) {
            return $requirements;
        }

        $requirementIds = $requirements->pluck('id')->all();

        $uploadsByRequirement = Upload::with('uploader')
            ->whereIn('requirement_id', $requirementIds)
            ->get()
            ->groupBy('requirement_id');

        $assignedUserIds = [];
        foreach ($requirements as $requirement) {
            $ids = $this->parseIdList($requirement->person_in_charge_user_ids);
            if ($ids) {
                $assignedUserIds = array_merge($assignedUserIds, $ids);
            }
        }
        $assignedUserIds = array_values(array_unique($assignedUserIds));

        $assignedUsers = $assignedUserIds
            ? User::whereIn('id', $assignedUserIds)->get()->keyBy('id')
            : collect();

        $today = Carbon::today();

        return $requirements->filter(function (Requirement $requirement) use ($uploadsByRequirement, $assignedUsers, $today) {
            $uploads = $uploadsByRequirement->get($requirement->id, collect());
            $status = $this->computeAdminComplianceStatus($requirement, $uploads, $assignedUsers, $today);
            return !str_starts_with($status, 'Complied');
        });
    }

    private function computeAdminComplianceStatus(
        Requirement $requirement,
        Collection $uploads,
        Collection $assignedUsers,
        Carbon $today
    ): string {
        if (!$requirement->deadline) {
            return '';
        }

        $deadline = Carbon::parse($requirement->deadline)->startOfDay();

        $approvedUploadNames = $this->collectUploadNames($uploads, true);
        $anyUploadNames = $this->collectUploadNames($uploads, false);

        $assignedIds = array_values(array_unique($this->parseIdList($requirement->person_in_charge_user_ids)));
        $totalAssigned = count($assignedIds);

        $approvedCount = 0;
        $submittedCount = 0;

        foreach ($assignedIds as $assignedId) {
            $assignedName = $assignedUsers->get($assignedId)?->employee_name ?? '';
            $normalizedName = $this->normalizeName($assignedName);
            if ($normalizedName !== '' && isset($approvedUploadNames[$normalizedName])) {
                $approvedCount += 1;
            }
            if ($normalizedName !== '' && isset($anyUploadNames[$normalizedName])) {
                $submittedCount += 1;
            }
        }

        if ($approvedCount === $totalAssigned) {
            return 'Complied (100%)';
        }

        if ($today->greaterThan($deadline) && $submittedCount === 0) {
            return 'Late (100%)';
        }

        $percent = $totalAssigned === 0
            ? 0
            : (int) round(100 * $submittedCount / $totalAssigned);

        return 'Pending (' . $percent . '%)';
    }

    private function parseIdList(?string $value): array
    {
        if (!$value) {
            return [];
        }

        $parts = preg_split('/\s*;\s*/', $value);
        return array_values(array_filter(array_map('intval', $parts)));
    }

    private function normalizeName(?string $value): string
    {
        return strtolower(trim((string) $value));
    }

    private function collectUploadNames(Collection $uploads, bool $approvedOnly): array
    {
        $names = [];
        foreach ($uploads as $upload) {
            if ($approvedOnly && $upload->approval_status !== 'APPROVED') {
                continue;
            }
            $name = $this->normalizeName($upload->uploader?->employee_name);
            if ($name !== '') {
                $names[$name] = true;
            }
        }
        return $names;
    }
}
