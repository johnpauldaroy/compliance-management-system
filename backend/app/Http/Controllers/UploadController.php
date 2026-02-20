<?php

namespace App\Http\Controllers;

use App\Models\Requirement;
use App\Models\Upload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Carbon\Carbon;
use Illuminate\Support\Facades\Mail;
use App\Models\User;
use App\Mail\SubmissionPendingReviewMail;
use App\Mail\SubmissionStatusMail;

class UploadController extends Controller
{
    public function store(Request $request)
    {
        $this->authorize('create', Upload::class);
        $request->validate([
            'requirement_id' => 'required|exists:requirements,id',
            'doc_file' => 'required|file|mimes:pdf|max:10240',
            'comments' => 'nullable|string',
            'deadline_at_upload' => 'nullable|date',
        ]);

        $user = Auth::user();
        $requirement = Requirement::findOrFail($request->requirement_id);

        // Find the assignment for this user
        $assignment = \App\Models\RequirementAssignment::where('requirement_id', $requirement->id)
            ->where('assigned_to_user_id', $user->id)
            ->first();

        // If PIC, they MUST have an assignment
        if ($user->hasRole('Person-In-Charge (PIC)') && !$assignment) {
            return response()->json(['message' => 'Unauthorized: You are not assigned to this requirement.'], 403);
        }

        // If Admin/Super Admin, they might not have an assignment (uploading on behalf or as reference)
        // But for per-PIC rule, we usually want it linked to an assignment if it's a submission.
        // If no assignment exists for the admin, we'll create one if they are actually a PIC, 
        // but here we'll assume they are uploading for the requirement master if no specific PIC is intended.
        // However, the table structure now requires assignment_id for tracking.
        $isAdmin = $user->hasAnyRole(['Compliance & Admin Specialist', 'Super Admin']);
        $deadlineDate = $assignment?->deadline ?? $requirement->deadline;
        if (!$isAdmin && !$deadlineDate) {
            return response()->json(['message' => 'Uploads are disabled until a deadline is set for this requirement.'], 422);
        }

        if (!$isAdmin && $deadlineDate) {
            $deadlineKey = Carbon::parse($deadlineDate)->toDateString();
            $approvedExists = Upload::where('requirement_id', $requirement->id)
                ->where('uploaded_by_user_id', $user->id)
                ->where('approval_status', 'APPROVED')
                ->whereDate('deadline_at_upload', $deadlineKey)
                ->exists();

            if ($approvedExists) {
                return response()->json(['message' => 'An approved upload already exists for this deadline.'], 422);
            }
        }

        $path = $request->file('doc_file')->store('compliance_docs');

        $canSetApproval = $user->hasRole('Compliance & Admin Specialist') || $user->hasRole('Super Admin');
        $approvalStatus = $canSetApproval && $request->filled('approval_status')
            ? $request->approval_status
            : 'PENDING';
        $adminRemarks = $canSetApproval ? $request->admin_remarks : null;

        return DB::transaction(function () use ($request, $requirement, $assignment, $path, $user, $approvalStatus, $adminRemarks, $isAdmin, $deadlineDate) {
            $upload = Upload::create([
                'upload_id' => 'UP-' . uniqid(),
                'requirement_id' => $requirement->id,
                'assignment_id' => $assignment?->id,
                'doc_file' => $path,
                'uploaded_by_user_id' => $user->id,
                'uploader_email' => $user->email,
                'upload_date' => now(),
                'deadline_at_upload' => $isAdmin
                    ? ($request->input('deadline_at_upload') ?: $deadlineDate)
                    : $deadlineDate,
                'comments' => $request->comments,
                'approval_status' => $approvalStatus,
                'admin_remarks' => $adminRemarks,
                'status_change_on' => $approvalStatus === 'PENDING' ? null : now(),
                'upload_year' => now()->year,
            ]);

            if ($assignment) {
                $statusMap = [
                    'APPROVED' => 'APPROVED',
                    'REJECTED' => 'REJECTED',
                    'PENDING' => 'SUBMITTED',
                ];
                $assignmentStatus = $statusMap[$approvalStatus] ?? 'SUBMITTED';

                $updateData = [
                    'compliance_status' => $assignmentStatus,
                ];

                if ($assignmentStatus === 'SUBMITTED') {
                    $updateData['last_submitted_at'] = now();
                } elseif ($assignmentStatus === 'APPROVED') {
                    $updateData['last_approved_at'] = now();
                    $updateData['last_submitted_at'] = now(); // Also count as submitted
                }

                $assignment->update($updateData);
            }

            if ($approvalStatus === 'PENDING') {
                $this->notifySpecialistsPendingReview($upload);
            }

            return response()->json($upload, 211);
        });
    }

    public function index()
    {
        $this->authorize('viewAny', Upload::class);
        $user = Auth::user();
        $query = Upload::with(['requirement.agency', 'uploader', 'assignment'])
            ->orderByDesc('upload_date');

        if (!$user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])) {
            $query->where('uploaded_by_user_id', $user->id);
        }

        return response()->json($query->get());
    }

    public function download(Request $request, Upload $upload)
    {
        $this->authorize('view', $upload);
        $user = Auth::user();

        // Admin can download anything. PIC can download their own uploads or anything assigned to them.
        $canAccess = $user->hasRole('Compliance & Admin Specialist')
            || $user->hasRole('Super Admin')
            || ($upload->uploaded_by_user_id === $user->id)
            || ($upload->assignment && $upload->assignment->assigned_to_user_id === $user->id);

        if (!$canAccess) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return $this->serveUploadFile($upload, $request);
    }

    public function signedUrl(Request $request, Upload $upload)
    {
        $this->authorize('view', $upload);
        $user = Auth::user();
        $canAccess = $user->hasRole('Compliance & Admin Specialist')
            || $user->hasRole('Super Admin')
            || ($upload->uploaded_by_user_id === $user->id)
            || ($upload->assignment && $upload->assignment->assigned_to_user_id === $user->id);

        if (!$canAccess) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $inline = filter_var($request->query('inline', false), FILTER_VALIDATE_BOOLEAN);
        $url = URL::temporarySignedRoute(
            'uploads.signed-download',
            Carbon::now()->addMinutes(5),
            ['upload' => $upload->id, 'inline' => $inline ? 1 : 0]
        );

        return response()->json(['url' => $url]);
    }

    public function signedDownload(Request $request, Upload $upload)
    {
        return $this->serveUploadFile($upload, $request);
    }

    public function approve(Request $request, Upload $upload)
    {
        $this->authorize('approve', $upload);
        $request->validate(['remarks' => 'nullable|string']);

        return DB::transaction(function () use ($request, $upload) {
            $upload->update([
                'approval_status' => 'APPROVED',
                'status_change_on' => now(),
                'admin_remarks' => $request->remarks,
            ]);

            if ($upload->assignment) {
                $upload->assignment->update([
                    'compliance_status' => 'APPROVED',
                    'last_approved_at' => now(),
                ]);
            }

            $this->notifySubmissionStatus($upload);

            return response()->json($upload);
        });
    }

    public function reject(Request $request, Upload $upload)
    {
        $this->authorize('reject', $upload);
        $request->validate(['remarks' => 'required|string']);

        return DB::transaction(function () use ($request, $upload) {
            $upload->update([
                'approval_status' => 'REJECTED',
                'status_change_on' => now(),
                'admin_remarks' => $request->remarks,
            ]);

            if ($upload->assignment) {
                $upload->assignment->update([
                    'compliance_status' => 'PENDING',
                ]);
            }

            $this->notifySubmissionStatus($upload);

            return response()->json($upload);
        });
    }

    private function serveUploadFile(Upload $upload, Request $request)
    {
        $path = $upload->doc_file;
        if (!$path || !Storage::exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $inline = filter_var($request->query('inline', false), FILTER_VALIDATE_BOOLEAN);
        $fullPath = Storage::path($path);
        $fileName = basename($path);

        if ($inline) {
            return response()->file($fullPath, [
                'Content-Disposition' => 'inline; filename="' . $fileName . '"',
            ]);
        }

        return response()->download($fullPath, $fileName);
    }

    private function notifySpecialistsPendingReview(Upload $upload): void
    {
        $specialistEmails = User::role(['Compliance & Admin Specialist', 'Super Admin'])
            ->pluck('email')
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($specialistEmails)) {
            return;
        }

        Mail::to($specialistEmails)->send(new SubmissionPendingReviewMail($upload));
    }

    private function notifySubmissionStatus(Upload $upload): void
    {
        $upload->loadMissing(['uploader', 'assignment.user', 'requirement']);

        $recipientEmail = $upload->uploader?->email
            ?? $upload->assignment?->user?->email
            ?? $upload->uploader_email;

        if (!$recipientEmail) {
            return;
        }

        Mail::to($recipientEmail)->send(new SubmissionStatusMail($upload));
    }
}
