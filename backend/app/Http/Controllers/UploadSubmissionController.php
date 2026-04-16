<?php

namespace App\Http\Controllers;

use App\Models\Upload;
use App\Models\UploadSubmission;
use App\Services\UploadSubmissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Carbon\Carbon;

class UploadSubmissionController extends Controller
{
    private UploadSubmissionService $submissionService;

    public function __construct(UploadSubmissionService $submissionService)
    {
        $this->submissionService = $submissionService;
    }

    public function store(Request $request)
    {
        $this->authorize('create', UploadSubmission::class);

        $filesInput = $request->file('doc_file');
        if ($filesInput === null) {
            $filesInput = $request->file('doc_file[]');
        }

        $rules = [
            'requirement_id' => 'required|exists:requirements,id',
            'comments' => 'nullable|string',
            'deadline_at_upload' => 'nullable|date',
            'assignment_id' => 'nullable|integer|exists:requirement_assignments,id',
        ];

        if (is_array($filesInput)) {
            $rules['doc_file'] = 'required|array|min:1';
            $rules['doc_file.*'] = 'file|mimes:pdf,csv,xls,xlsx|max:256000';
        } else {
            $rules['doc_file'] = 'required|file|mimes:pdf,csv,xls,xlsx|max:256000';
        }

        $request->validate($rules);

        $files = is_array($filesInput) ? $filesInput : [$filesInput];

        $submission = $this->submissionService->createSubmission($request, Auth::user(), $files);

        return response()->json($submission, 211);
    }

    public function index()
    {
        $this->authorize('viewAny', UploadSubmission::class);
        $user = Auth::user();
        $query = UploadSubmission::with(['requirement.agency', 'uploader', 'assignment.user', 'files'])
            ->orderByDesc('upload_date');

        if (!$user->hasAnyRole(['Super Admin', 'Compliance & Admin Specialist'])) {
            $query->where('uploaded_by_user_id', $user->id);
        }

        return response()->json($query->get());
    }

    public function approve(Request $request, UploadSubmission $submission)
    {
        $this->authorize('approve', $submission);
        $request->validate(['remarks' => 'nullable|string']);

        $submission = $this->submissionService->approveSubmission($submission, $request->remarks);

        return response()->json($submission);
    }

    public function reject(Request $request, UploadSubmission $submission)
    {
        $this->authorize('reject', $submission);
        $request->validate(['remarks' => 'required|string']);

        $submission = $this->submissionService->rejectSubmission($submission, $request->remarks);

        return response()->json($submission);
    }

    public function fileDownload(Request $request, UploadSubmission $submission, Upload $upload)
    {
        $this->authorize('view', $submission);
        if ($upload->submission_id !== $submission->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return $this->serveUploadFile($upload, $request);
    }

    public function fileSignedUrl(Request $request, UploadSubmission $submission, Upload $upload)
    {
        $this->authorize('view', $submission);
        if ($upload->submission_id !== $submission->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $inline = filter_var($request->query('inline', false), FILTER_VALIDATE_BOOLEAN);
        $url = URL::temporarySignedRoute(
            'submissions.files.signed-download',
            Carbon::now()->addMinutes(5),
            [
                'submission' => $submission->id,
                'upload' => $upload->id,
                'inline' => $inline ? 1 : 0,
            ]
        );

        return response()->json(['url' => $url]);
    }

    public function fileSignedDownload(Request $request, UploadSubmission $submission, Upload $upload)
    {
        if ($upload->submission_id !== $submission->id) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        return $this->serveUploadFile($upload, $request);
    }

    private function serveUploadFile(Upload $upload, Request $request)
    {
        $path = $upload->doc_file;
        if (!$path) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $inline = filter_var($request->query('inline', false), FILTER_VALIDATE_BOOLEAN)
            && $this->supportsInlineView($upload);
        $fileName = basename($path);
        $disk = $this->resolveUploadDisk($path);

        if (!$disk) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $driver = config("filesystems.disks.$disk.driver");
        if ($driver !== 'local') {
            $stream = Storage::disk($disk)->readStream($path);
            if (!$stream) {
                return response()->json(['message' => 'File not found.'], 404);
            }

            $disposition = $inline ? 'inline' : 'attachment';
            $headers = [
                'Content-Type' => 'application/octet-stream',
                'Content-Disposition' => $disposition . '; filename="' . $fileName . '"',
            ];

            return response()->stream(function () use ($stream) {
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, 200, $headers);
        }

        $fullPath = Storage::disk($disk)->path($path);

        if ($inline) {
            return response()->file($fullPath, [
                'Content-Disposition' => 'inline; filename="' . $fileName . '"',
            ]);
        }

        return response()->download($fullPath, $fileName);
    }

    private function supportsInlineView(Upload $upload): bool
    {
        $fileName = $upload->original_file_name ?: $upload->doc_file;
        $extension = strtolower((string) pathinfo((string) $fileName, PATHINFO_EXTENSION));

        return $extension === 'pdf';
    }

    private function resolveUploadDisk(string $path): ?string
    {
        $candidates = array_values(array_unique([
            config('filesystems.default'),
            'public',
            'local',
        ]));

        foreach ($candidates as $disk) {
            if ($disk && Storage::disk($disk)->exists($path)) {
                return $disk;
            }
        }

        return null;
    }
}
