<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Compliance Overdue</title>
</head>
<body>
    <p>Hi {{ $assignment->user?->employee_name ?? 'PIC' }},</p>

    <p>The following compliance requirement is now overdue:</p>

    <ul>
        <li><strong>Requirement:</strong> {{ $assignment->requirement?->requirement ?? 'N/A' }}</li>
        <li><strong>Deadline:</strong> {{ $assignment->deadline ? $assignment->deadline->format('F j, Y') : 'Not set' }}</li>
        <li><strong>Status:</strong> {{ $assignment->compliance_status ?? 'PENDING' }}</li>
    </ul>

    <p>Please submit your compliance documents as soon as possible.</p>

    <p>Thank you,<br>Compliance Team</p>
</body>
</html>
