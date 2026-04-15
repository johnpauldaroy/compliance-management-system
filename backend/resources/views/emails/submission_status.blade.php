<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Submission Status</title>
</head>
<body>
    <p>Hi {{ $submission->uploader?->employee_name ?? 'PIC' }},</p>

    <p>Your compliance submission has been <strong>{{ strtoupper($submission->approval_status) }}</strong>.</p>

    <ul>
        <li><strong>Requirement:</strong> {{ $submission->requirement?->requirement ?? 'N/A' }}</li>
        <li><strong>Submitted on:</strong> {{ $submission->upload_date ? $submission->upload_date->format('F j, Y g:i A') : 'N/A' }}</li>
        <li><strong>Reviewer remarks:</strong> {{ $submission->admin_remarks ?? 'None' }}</li>
    </ul>

    <p>If you have questions, please contact the compliance team.</p>

    <p>Thank you,<br>Compliance Team</p>
</body>
</html>
