import { List, Card, Button, Tag, Space, Typography, Drawer, Descriptions, Upload, message, Modal, Form, Input, Select, Collapse, Tooltip, DatePicker, Empty } from 'antd';
import { UploadOutlined, ClockCircleOutlined, FileTextOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { requirementService, uploadService } from '../services/apiService';
import { authService } from '../services/authService';
import type { Requirement, RequirementAssignment, Upload as UploadFileRecord, UploadSubmission, User } from '../types';
import type { UploadFile } from 'antd/es/upload/interface';
import './MyRequirementsPage.css';

const { Text, Title } = Typography;

const formatPhDate = (value?: string | null) => {
    if (!value) {
        return 'N/A';
    }
    const date = value.includes('T')
        ? new Date(value)
        : new Date(`${value}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

const toPhDateKey = (value?: string | null) => {
    if (!value) {
        return '';
    }
    const date = value.includes('T')
        ? new Date(value)
        : new Date(`${value}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
};

const toDeadlineDayjs = (value?: string | null) => {
    if (!value) {
        return null;
    }
    const raw = value.includes('T') ? value : `${value}T00:00:00+08:00`;
    const parsed = dayjs(raw);
    if (parsed.isValid()) {
        return parsed;
    }
    const fallbackKey = toPhDateKey(value);
    if (!fallbackKey) {
        return null;
    }
    const fallback = dayjs(fallbackKey);
    return fallback.isValid() ? fallback : null;
};

const allowedUploadExtensions = ['.pdf', '.csv', '.xls', '.xlsx'];
const maxUploadSizeBytes = 250 * 1024 * 1024;
const uploadAccept = '.pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const isInlineViewableFile = (file?: { original_file_name?: string | null; doc_file?: string | null } | null) => {
    const name = (file?.original_file_name || file?.doc_file || '').toLowerCase();
    return name.endsWith('.pdf');
};
const triggerFileDownload = (blob: Blob, fileName: string) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
};

type MeResponse = { user: User };

const MyRequirementsPage = () => {
    const [form] = Form.useForm();
    const [detailId, setDetailId] = useState<number | null>(null);
    const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadRequirementId, setUploadRequirementId] = useState<number | null>(null);
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [filesModalOpen, setFilesModalOpen] = useState(false);
    const [activeFiles, setActiveFiles] = useState<UploadFileRecord[]>([]);
    const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
    const { data: requirements, isLoading, error: requirementsError } = useQuery<Requirement[]>({
        queryKey: ['my-requirements'],
        queryFn: () => requirementService.getMine(),
    });

    const { data: meData } = useQuery<MeResponse>({
        queryKey: ['me'],
        queryFn: () => authService.me(),
    });

    const { data: detailData, isLoading: isDetailLoading, error: detailError, refetch: refetchDetails } = useQuery<Requirement>({
        queryKey: ['my-requirement-detail', detailId],
        queryFn: () => requirementService.show(detailId as number),
        enabled: Boolean(detailId),
    });
    useEffect(() => {
        if (!requirementsError) {
            return;
        }
        const error = requirementsError as { response?: { data?: { message?: string } } };
        message.error(error.response?.data?.message || 'Failed to load requirements.');
    }, [requirementsError]);

    useEffect(() => {
        if (!detailError || !detailId) {
            return;
        }
        if (detailData || selectedRequirement) {
            return;
        }
        const error = detailError as { response?: { data?: { message?: string } } };
        message.error(error.response?.data?.message || 'Failed to load requirement details.');
    }, [detailError, detailId, detailData, selectedRequirement]);

    const isAdmin = useMemo(() => {
        const roles = meData?.user?.roles || [];
        return roles.some((role: any) =>
            role?.name === 'Compliance & Admin Specialist' || role?.name === 'Super Admin'
        );
    }, [meData]);

    const canEditApproval = isAdmin;

    const getComplianceDisplay = (status?: string) => {
        const normalized = (status || '').trim().toUpperCase();
        if (!normalized) {
            return 'N/A';
        }
        if (normalized === 'APPROVED') {
            return 'Complied';
        }
        if (normalized === 'OVERDUE') {
            return 'Overdue';
        }
        if (normalized === 'SUBMITTED') {
            return 'For Approval';
        }
        if (normalized === 'PENDING' || normalized === 'REJECTED') {
            return 'Pending';
        }
        return status ?? 'N/A';
    };

    const getStatusColor = (status?: string) => {
        const normalized = (status || '').trim().toLowerCase();
        if (normalized.startsWith('complied')) {
            return 'success';
        }
        if (normalized.startsWith('late') || normalized.startsWith('overdue')) {
            return 'error';
        }
        if (normalized.startsWith('for approval')) {
            return 'processing';
        }
        if (normalized.startsWith('pending')) {
            return 'processing';
        }
        if (!normalized) {
            return 'default';
        }
        return 'warning';
    };

    const handleViewUpload = async (submissionId: number, uploadId: number, file?: UploadFileRecord | null) => {
        try {
            const inline = isInlineViewableFile(file);
            if (inline) {
                const { url } = await uploadService.getSignedUrl(submissionId, uploadId, true);
                window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }

            const blob = await uploadService.download(submissionId, uploadId, false);
            triggerFileDownload(blob, getFileName(file));
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to open file.');
        }
    };

    const getFileName = (file?: UploadFileRecord | null) => {
        const original = file?.original_file_name;
        if (original) {
            return original;
        }
        const path = file?.doc_file;
        if (!path) {
            return 'View file';
        }
        const parts = path.split('/');
        return parts[parts.length - 1] || 'View file';
    };

    const openFilesModal = (submissionId: number, files: UploadFileRecord[]) => {
        setActiveSubmissionId(submissionId);
        setActiveFiles(files || []);
        setFilesModalOpen(true);
    };

    const getOrderedAssignments = (assignments: RequirementAssignment[], isSequential: boolean) => {
        if (!isSequential) {
            return assignments;
        }
        return [...assignments].sort((a, b) => {
            const aOrder = a.sequence_order ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sequence_order ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            return (a.id || 0) - (b.id || 0);
        });
    };

    const getActiveSequentialAssignment = (assignments: RequirementAssignment[]) =>
        assignments.find((assignment) => assignment.compliance_status !== 'APPROVED');

    const resolveAssignmentDeadlineValue = (
        assignments: RequirementAssignment[],
        assignmentId?: number | null,
        fallbackDeadline?: string | null
    ) => {
        const assignmentDeadline = assignmentId
            ? assignments.find((assignment) => assignment.id === assignmentId)?.deadline
            : undefined;
        return toDeadlineDayjs(assignmentDeadline || fallbackDeadline);
    };

    const getUserAssignment = (assignments: RequirementAssignment[], userId?: number) => {
        if (!userId) {
            return null;
        }

        return assignments.find((assignment) => assignment.assigned_to_user_id === userId) || null;
    };

    return (
        <div className="myreq-page">
            <Title level={2} className="myreq-title">My Compliance Requirements</Title>

            <List<Requirement>
                grid={{ gutter: 16, column: 1 }}
                dataSource={requirements ?? []}
                loading={isLoading}
                renderItem={(item) => (
                    <List.Item>
                        <Card>
                            <div className="myreq-card">
                                <div className="myreq-info">
                                    <div className="myreq-icon">
                                        <FileTextOutlined />
                                    </div>
                                    <div>
                                        <Text strong className="myreq-name">
                                            {item.requirement}
                                        </Text>
                                        <Text type="secondary" className="myreq-subtitle">
                                            {item.agency?.name}
                                        </Text>
                                        <div className="myreq-deadline">
                                    <ClockCircleOutlined className="myreq-deadline-icon" />
                                    Deadline: {formatPhDate(item.deadline)}
                                        </div>
                                    </div>
                                </div>

                                <Space size="large">
                                    <Tag color={getStatusColor(getComplianceDisplay(item.compliance_status))}>
                                        {getComplianceDisplay(item.compliance_status)}
                                    </Tag>
                                    <Space>
                                        <Button
                                            onClick={() => {
                                                setSelectedRequirement(item);
                                                setDetailId(item.id);
                                            }}
                                        >
                                            Details
                                        </Button>
                                    </Space>
                                </Space>
                            </div>
                        </Card>
                    </List.Item>
                )}
            />
            <Drawer
                title="Requirement Details"
                open={Boolean(detailId)}
                onClose={() => {
                    setDetailId(null);
                    setSelectedRequirement(null);
                }}
                width={840}
                destroyOnClose
                className="requirements-drawer"
            >
                {(() => {
                    const data = {
                        ...(selectedRequirement || {}),
                        ...(detailData || {}),
                    } as Requirement;
                    if (isDetailLoading) {
                        return <Text type="secondary">Loading...</Text>;
                    }
                    if (!selectedRequirement && !detailData) {
                        return <Text type="secondary">No details found.</Text>;
                    }
                    return (
                        <>
                            <Descriptions column={2} bordered size="small">
                                <Descriptions.Item label="Requirement ID">
                                    {data.req_id || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Agency">
                                    {data.agency?.name || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Category">
                                    {data.category || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Requirement Name" span={2}>
                                    {data.requirement || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Description" span={2}>
                                    {data.description || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Frequency">
                                    {data.frequency || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Schedule">
                                    {data.schedule || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label={data.assignment_mode === 'sequential' ? 'Final Deadline' : 'Deadline'}>
                                    {formatPhDate(data.deadline)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Assignment Mode">
                                    {data.assignment_mode ? data.assignment_mode.toUpperCase() : 'PARALLEL'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Person-In-Charge" span={2}>
                                    {data.assignments && data.assignments.length > 0 ? (
                                        <div className="myreq-assignments-list">
                                            {(() => {
                                                const isSequential = data.assignment_mode === 'sequential';
                                                const orderedAssignments = getOrderedAssignments(data.assignments, isSequential);
                                                const activeAssignmentId = isSequential
                                                    ? orderedAssignments.find((assignment) => assignment.compliance_status !== 'APPROVED')?.id
                                                    : null;

                                                return orderedAssignments.map((assignment, index) => (
                                                    <div key={assignment.id} className="myreq-assignment-item">
                                                        <div className="myreq-assignment-header">
                                                            <span className="myreq-assignment-name">
                                                                {isSequential ? `${index + 1}. ` : ''}{assignment.user?.employee_name || 'N/A'}
                                                            </span>
                                                            <div className="myreq-assignment-tags">
                                                                {isSequential && activeAssignmentId === assignment.id ? (
                                                                    <Tag color="gold">ACTIVE</Tag>
                                                                ) : null}
                                                                <Tag color={
                                                                    assignment.compliance_status === 'APPROVED' ? 'green' :
                                                                        assignment.compliance_status === 'REJECTED' ? 'red' :
                                                                            assignment.compliance_status === 'SUBMITTED' ? 'blue' :
                                                                                assignment.compliance_status === 'OVERDUE' ? 'orange' : 'default'
                                                                }>
                                                                    {assignment.compliance_status}
                                                                </Tag>
                                                            </div>
                                                        </div>
                                                        <div className="myreq-assignment-meta">
                                                            <span className="myreq-assignment-meta-item">
                                                                <span className="myreq-assignment-meta-label">Deadline</span>
                                                                <span className="myreq-assignment-meta-value">{formatPhDate(assignment.deadline)}</span>
                                                            </span>
                                                            <span className="myreq-assignment-meta-item">
                                                                <span className="myreq-assignment-meta-label">Submitted</span>
                                                                <span className="myreq-assignment-meta-value">
                                                                    {assignment.last_submitted_at ? new Date(assignment.last_submitted_at).toLocaleDateString() : 'N/A'}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    ) : 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Compliance Status" span={2}>
                                    {getComplianceDisplay(data.compliance_status)}
                                </Descriptions.Item>
                            </Descriptions>

                            <div style={{ marginTop: 24 }}>
                                <Title level={5}>Uploads</Title>
                                {(() => {
                                    const submissions = data.submissions ?? [];
                                    const currentUserId = meData?.user?.id;
                                    const assignmentSource = data;
                                    const isSequential = assignmentSource?.assignment_mode === 'sequential';
                                    const orderedAssignments = isSequential
                                        ? [...(assignmentSource?.assignments || [])].sort((a, b) => {
                                            const aOrder = a.sequence_order ?? Number.MAX_SAFE_INTEGER;
                                            const bOrder = b.sequence_order ?? Number.MAX_SAFE_INTEGER;
                                            if (aOrder !== bOrder) {
                                                return aOrder - bOrder;
                                            }
                                            return (a.id || 0) - (b.id || 0);
                                        })
                                        : (assignmentSource?.assignments || []);
                                    const activeAssignment = isSequential
                                        ? orderedAssignments.find((assignment) =>
                                            assignment.compliance_status !== 'APPROVED'
                                        )
                                        : null;
                                    const currentUserAssignment = getUserAssignment(orderedAssignments, currentUserId);
                                    const deadlineKey = toPhDateKey(
                                        isSequential
                                            ? (currentUserAssignment?.deadline || activeAssignment?.deadline || '')
                                            : (currentUserAssignment?.deadline || data.deadline)
                                    );
                                    const isActiveForUser = !isSequential
                                        ? true
                                        : activeAssignment?.assigned_to_user_id === currentUserId;
                                    const isSubmissionForCurrentUser = (submission: UploadSubmission, userId?: number) => {
                                        if (!userId) {
                                            return false;
                                        }
                                        return submission.uploaded_by_user_id === userId
                                            || submission.assignment?.assigned_to_user_id === userId;
                                    };
                                    const approvedForDeadline = Boolean(
                                        deadlineKey
                                            && currentUserId
                                            && submissions.some((submission) =>
                                                submission.approval_status === 'APPROVED'
                                                && isSubmissionForCurrentUser(submission, currentUserId)
                                                && toPhDateKey(submission.deadline_at_upload) === deadlineKey
                                            )
                                    );
                                    const pendingForDeadline = Boolean(
                                        deadlineKey
                                            && currentUserId
                                            && submissions.some((submission) =>
                                                submission.approval_status === 'PENDING'
                                                && isSubmissionForCurrentUser(submission, currentUserId)
                                                && toPhDateKey(submission.deadline_at_upload) === deadlineKey
                                            )
                                    );
                                    const uploadTooltip = !isAdmin && !deadlineKey
                                        ? 'Set a deadline to enable uploads.'
                                        : !isAdmin && pendingForDeadline
                                            ? 'You have a pending submission. We will inform you of the approval or rejection via email.'
                                            : !isAdmin && !isActiveForUser && approvedForDeadline
                                                ? 'You have already complied with this requirement.'
                                                : !isAdmin && !isActiveForUser
                                                    ? 'This requirement is sequential. Please wait for the preceding active Person-in-Charge to comply before you. We will send an email when it is your turn.'
                                                    : !isAdmin && approvedForDeadline
                                                        ? 'You have already complied with this requirement.'
                                                        : '';
                                    const uploadDisabled = !isAdmin && (!deadlineKey || approvedForDeadline || pendingForDeadline || !isActiveForUser);
                                    return (
                                        <>
                                            {uploadDisabled ? (
                                                <Tooltip title={uploadTooltip} placement="top">
                                                    <Button
                                                        type="primary"
                                                        icon={<UploadOutlined />}
                                                        onClick={() => {
                                                            setUploadRequirementId(data.id);
                                                            setUploadFiles([]);
                                                            form.resetFields();
                                                            const assignments = detailData?.assignments || data.assignments || [];
                                                            const isSequential = (detailData?.assignment_mode || data.assignment_mode) === 'sequential';
                                                            const orderedAssignments = getOrderedAssignments(assignments as RequirementAssignment[], isSequential);
                                                            const activeSequential = isSequential ? getActiveSequentialAssignment(orderedAssignments) : null;
                                                            const autoAssignmentId = activeSequential?.id || (orderedAssignments.length === 1 ? orderedAssignments[0].id : null);
                                                            const deadlineValue = resolveAssignmentDeadlineValue(
                                                                orderedAssignments,
                                                                autoAssignmentId,
                                                                data.deadline
                                                            );
                                                            if (isAdmin && deadlineValue) {
                                                                form.setFieldsValue({ deadline_at_upload: deadlineValue });
                                                            }
                                                            if (autoAssignmentId) {
                                                                form.setFieldsValue({ assignment_id: autoAssignmentId });
                                                            }
                                                            setUploadModalOpen(true);
                                                        }}
                                                        style={{ marginBottom: 12 }}
                                                        disabled
                                                    >
                                                        Upload
                                                    </Button>
                                                </Tooltip>
                                            ) : (
                                                <Button
                                                    type="primary"
                                                    icon={<UploadOutlined />}
                                                    onClick={() => {
                                                        setUploadRequirementId(data.id);
                                                        setUploadFiles([]);
                                                        form.resetFields();
                                                        const assignments = detailData?.assignments || data.assignments || [];
                                                        const isSequential = (detailData?.assignment_mode || data.assignment_mode) === 'sequential';
                                                        const orderedAssignments = getOrderedAssignments(assignments as RequirementAssignment[], isSequential);
                                                        const activeSequential = isSequential ? getActiveSequentialAssignment(orderedAssignments) : null;
                                                        const autoAssignmentId = activeSequential?.id || (orderedAssignments.length === 1 ? orderedAssignments[0].id : null);
                                                        const deadlineValue = resolveAssignmentDeadlineValue(
                                                            orderedAssignments,
                                                            autoAssignmentId,
                                                            data.deadline
                                                        );
                                                        if (isAdmin && deadlineValue) {
                                                            form.setFieldsValue({ deadline_at_upload: deadlineValue });
                                                        }
                                                        if (autoAssignmentId) {
                                                            form.setFieldsValue({ assignment_id: autoAssignmentId });
                                                        }
                                                        setUploadModalOpen(true);
                                                    }}
                                                    style={{ marginBottom: 12 }}
                                                >
                                                    Upload
                                                </Button>
                                            )}
                                            {(!submissions.length) ? (
                                                <div style={{ textAlign: 'center', marginTop: 8 }}>
                                                    <Text type="secondary">No uploads yet.</Text>
                                                </div>
                                            ) : null}
                                            {submissions.length ? (() => {
                                                const grouped = submissions.reduce<Record<string, UploadSubmission[]>>((acc, submission) => {
                                                    const key = submission.deadline_at_upload ? toPhDateKey(submission.deadline_at_upload) : 'no-deadline';
                                                    acc[key] = acc[key] || [];
                                                    acc[key].push(submission);
                                                    return acc;
                                                }, {});
                                                const items = Object.entries(grouped)
                                                    .sort(([aKey], [bKey]) => {
                                                        if (aKey === 'no-deadline') return 1;
                                                        if (bKey === 'no-deadline') return -1;
                                                        return bKey.localeCompare(aKey);
                                                    })
                                                    .map(([key, items]) => {
                                                const label = key === 'no-deadline'
                                                    ? 'Deadline: No deadline'
                                                    : `Deadline: ${formatPhDate(key)}`;
                                                    return {
                                                        key,
                                                        label,
                                                        children: (
                                                            <List<UploadSubmission>
                                                                dataSource={items}
                                                                renderItem={(submission) => (
                                                                    <List.Item>
                                                                <Card style={{ width: '100%' }}>
                                                                    <div className="myreq-submission-card">
                                                                        <div className="myreq-submission-header">
                                                                            <Text strong>{submission.submission_id}</Text>
                                                                            <Tag color={submission.approval_status === 'APPROVED' ? 'success' : submission.approval_status === 'REJECTED' ? 'error' : 'processing'}>
                                                                                {submission.approval_status}
                                                                            </Tag>
                                                                        </div>
                                                                        <div className="myreq-submission-grid">
                                                                            <div className="myreq-submission-item">
                                                                                <span className="myreq-submission-label">Uploaded by</span>
                                                                                <span className="myreq-submission-value">
                                                                                    {submission.uploader?.employee_name || submission.uploader_email}
                                                                                </span>
                                                                            </div>
                                                                            {(() => {
                                                                                const uploadedFor = submission.assignment?.user?.employee_name;
                                                                                const assignedUserId = submission.assignment?.assigned_to_user_id;
                                                                                const showUploadedFor = Boolean(
                                                                                    uploadedFor
                                                                                    && assignedUserId
                                                                                    && assignedUserId !== submission.uploaded_by_user_id
                                                                                );
                                                                                if (!showUploadedFor) {
                                                                                    return null;
                                                                                }
                                                                                return (
                                                                                    <div className="myreq-submission-item">
                                                                                        <span className="myreq-submission-label">Uploaded for</span>
                                                                                        <span className="myreq-submission-value">{uploadedFor}</span>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                            <div className="myreq-submission-item">
                                                                                <span className="myreq-submission-label">Uploaded at</span>
                                                                                <span className="myreq-submission-value">
                                                                                    {submission.upload_date ? new Date(submission.upload_date).toLocaleString() : 'N/A'}
                                                                                </span>
                                                                            </div>
                                                                            {submission.deadline_at_upload ? (
                                                                                <div className="myreq-submission-item">
                                                                                    <span className="myreq-submission-label">Submitted for Deadline Set On</span>
                                                                                    <span className="myreq-submission-value">
                                                                                        {formatPhDate(submission.deadline_at_upload)}
                                                                                    </span>
                                                                                </div>
                                                                            ) : null}
                                                                            {submission.approval_status !== 'PENDING' ? (
                                                                                <div className="myreq-submission-item">
                                                                                    <span className="myreq-submission-label">
                                                                                        {submission.approval_status === 'APPROVED' ? 'Approved at' : 'Rejected at'}
                                                                                    </span>
                                                                                    <span className="myreq-submission-value">
                                                                                        {submission.status_change_on ? new Date(submission.status_change_on).toLocaleString() : 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                            ) : null}
                                                                            {submission.uploaded_by_user_id === meData?.user?.id ? (
                                                                                <>
                                                                                    {submission.comments ? (
                                                                                        <div className="myreq-submission-item myreq-submission-item--full">
                                                                                            <span className="myreq-submission-label">Your comment</span>
                                                                                            <span className="myreq-submission-value">{submission.comments}</span>
                                                                                        </div>
                                                                                    ) : null}
                                                                                    {submission.admin_remarks ? (
                                                                                        <div className="myreq-submission-item myreq-submission-item--full">
                                                                                            <span className="myreq-submission-label">Admin remarks</span>
                                                                                            <span className="myreq-submission-value">{submission.admin_remarks}</span>
                                                                                        </div>
                                                                                    ) : null}
                                                                                </>
                                                                            ) : null}
                                                                        </div>
                                                                        <div className="myreq-submission-actions">
                                                                            {submission.files?.length ? (() => {
                                                                                const canViewSubmissionFiles = Boolean(
                                                                                    isAdmin
                                                                                    || submission.uploaded_by_user_id === currentUserId
                                                                                    || submission.approval_status === 'APPROVED'
                                                                                );
                                                                                if (!canViewSubmissionFiles) {
                                                                                    return null;
                                                                                }
                                                                                return (
                                                                                    <Button
                                                                                        size="small"
                                                                                        className="view-files-btn"
                                                                                        icon={<EyeOutlined />}
                                                                                        onClick={() => openFilesModal(submission.id, submission.files as UploadFileRecord[])}
                                                                                    >
                                                                                        View Files ({submission.files.length})
                                                                                    </Button>
                                                                                );
                                                                            })() : null}
                                                                        </div>
                                                                    </div>
                                                                </Card>
                                                            </List.Item>
                                                        )}
                                                    />
                                                        ),
                                                    };
                                                    });
                                                return (
                                                    <Collapse items={items} />
                                                );
                                            })() : null}
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    );
                })()}
            </Drawer>
            <Modal
                title="Upload Requirement File"
                open={uploadModalOpen}
                onCancel={() => setUploadModalOpen(false)}
                onOk={() => form.submit()}
                okText="Submit"
                okButtonProps={{ disabled: isUploading }}
                confirmLoading={isUploading}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={(values) => {
                        if (!uploadRequirementId) {
                            message.error('No requirement selected.');
                            return;
                        }
                        if (!uploadFiles.length) {
                            message.error('Please select at least one file to upload.');
                            return;
                        }
                        const formData = new FormData();
                        formData.append('requirement_id', String(uploadRequirementId));
                        uploadFiles.forEach((file) => {
                            const rawFile = (file as any).originFileObj || file;
                            formData.append('doc_file[]', rawFile as File);
                        });
                        if (values.assignment_id) {
                            formData.append('assignment_id', String(values.assignment_id));
                        }
                        if (values.comments) {
                            formData.append('comments', values.comments);
                        }
                        if (canEditApproval) {
                            if (values.approval_status) {
                                formData.append('approval_status', values.approval_status);
                            }
                            if (values.deadline_at_upload) {
                                formData.append('deadline_at_upload', values.deadline_at_upload.format('YYYY-MM-DD'));
                            }
                            if (values.admin_remarks) {
                                formData.append('admin_remarks', values.admin_remarks);
                            }
                        }
                        setIsUploading(true);
                        uploadService.upload(formData)
                            .then(() => {
                                message.success('File uploaded.');
                                setUploadModalOpen(false);
                                refetchDetails();
                            })
                            .catch((error: any) => {
                                message.error(error.response?.data?.message || 'Failed to upload file.');
                            })
                            .finally(() => {
                                setIsUploading(false);
                            });
                    }}
                >
                    <Form.Item label="Document File" required>
                        <Upload
                            accept={uploadAccept}
                            multiple
                            fileList={uploadFiles}
                            beforeUpload={(file) => {
                                const lowerName = file.name.toLowerCase();
                                const isAllowed = allowedUploadExtensions.some((extension) => lowerName.endsWith(extension));
                                if (!isAllowed) {
                                    message.error('Only PDF, CSV, XLS, and XLSX files are allowed.');
                                    return Upload.LIST_IGNORE;
                                }
                                if (file.size > maxUploadSizeBytes) {
                                    message.error('Each file must be 250MB or less.');
                                    return Upload.LIST_IGNORE;
                                }
                                return false;
                            }}
                            onChange={(info) => {
                                setUploadFiles(info.fileList.map((item) => ({ ...item, status: 'done' })));
                            }}
                            onRemove={(file) => {
                                setUploadFiles((prev) => prev.filter((item) => item.uid !== file.uid));
                            }}
                        >
                            <Button icon={<UploadOutlined />} disabled={isUploading}>Select File</Button>
                        </Upload>
                    </Form.Item>
                    {canEditApproval ? (() => {
                        const assignments = detailData?.assignments || selectedRequirement?.assignments || [];
                        if (!assignments.length) {
                            return null;
                        }
                        const isSequential = (detailData?.assignment_mode || selectedRequirement?.assignment_mode) === 'sequential';
                        const orderedAssignments = getOrderedAssignments(assignments as RequirementAssignment[], isSequential);
                        const activeSequential = isSequential ? getActiveSequentialAssignment(orderedAssignments) : null;
                        const selectable = isSequential
                            ? (activeSequential ? [activeSequential] : [])
                            : orderedAssignments;
                        const requireSelection = selectable.length > 1;
                        return (
                            <Form.Item
                                label="Upload for PIC"
                                name="assignment_id"
                                rules={requireSelection ? [{ required: true, message: 'Select a PIC.' }] : []}
                            >
                                <Select
                                    options={selectable.map((assignment) => ({
                                        value: assignment.id,
                                        label: assignment.user?.employee_name || `PIC #${assignment.assigned_to_user_id}`,
                                    }))}
                                    placeholder={isSequential ? 'Active PIC only' : 'Select a PIC'}
                                    disabled={selectable.length === 1}
                                    onChange={(value) => {
                                        const deadlineValue = resolveAssignmentDeadlineValue(
                                            selectable as RequirementAssignment[],
                                            value,
                                            detailData?.deadline || selectedRequirement?.deadline
                                        );
                                        form.setFieldsValue({
                                            deadline_at_upload: deadlineValue || undefined,
                                        });
                                    }}
                                />
                            </Form.Item>
                        );
                    })() : null}
                    <Form.Item label="Comments" name="comments">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    {canEditApproval ? (
                        <>
                            <Form.Item label="Approval Status" name="approval_status">
                                <Select
                                    options={[
                                        { value: 'PENDING', label: 'PENDING' },
                                        { value: 'APPROVED', label: 'APPROVED' },
                                        { value: 'REJECTED', label: 'REJECTED' },
                                    ]}
                                />
                            </Form.Item>
                            <Form.Item label="Deadline for this upload" name="deadline_at_upload">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item label="Admin Remarks" name="admin_remarks">
                                <Input.TextArea rows={3} />
                            </Form.Item>
                        </>
                    ) : null}
                </Form>
            </Modal>
            <Modal
                title="Uploaded Files"
                open={filesModalOpen}
                onCancel={() => setFilesModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                {activeFiles.length ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {activeFiles.map((file) => (
                            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{getFileName(file)}</span>
                                <Button
                                    size="small"
                                    className="view-file-btn"
                                    icon={<EyeOutlined />}
                                    onClick={() => {
                                        if (activeSubmissionId) {
                                            handleViewUpload(activeSubmissionId, file.id, file);
                                        }
                                    }}
                                >
                                    View
                                </Button>
                            </div>
                        ))}
                    </Space>
                ) : (
                    <Empty description="No files found" />
                )}
            </Modal>
        </div>
    );
};

export default MyRequirementsPage;
