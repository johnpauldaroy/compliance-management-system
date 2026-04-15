<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Requirement Assignment</title>
</head>
<body>
    <p>Hi {{ $assignment->user?->employee_name ?? 'PIC' }},</p>

    @if ($context === 'updated')
        <p>The deadline for a compliance requirement assigned to you has been updated.</p>
    @elseif ($context === 'activated')
        <p>The preceding Person-in-Charge has been approved. It is now your turn to submit your compliance documents.</p>
    @else
        <p>A compliance requirement has been assigned to you.</p>
    @endif

    <ul>
        <li><strong>Requirement:</strong> {{ $assignment->requirement?->requirement ?? 'N/A' }}</li>
        <li><strong>Deadline:</strong> {{ $assignment->deadline ? $assignment->deadline->format('F j, Y') : 'Not set' }}</li>
    </ul>

    <p>Please make sure to submit your compliance documents before the deadline.</p>

    <p>Thank you,<br>Compliance Team</p>
</body>
</html>
