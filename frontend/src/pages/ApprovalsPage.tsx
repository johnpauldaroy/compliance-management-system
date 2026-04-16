import { Table, Button, Space, message, Typography, Empty, Modal, Form, Input, Spin, Drawer, Descriptions, Tag, Tooltip, Tabs } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requirementService, uploadService } from '../services/apiService';
import { authService } from '../services/authService';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import './ApprovalsPage.css';

const { Title } = Typography;

const isInlineViewableFile = (file?: { original_file_name?: string | null; doc_file?: string | null }) => {
    const name = (file?.original_file_name || file?.doc_file || '').toLowerCase();
    return name.endsWith('.pdf');
};

const ApprovalsPage = () => {
    const queryClient = useQueryClient();
    const [form] = Form.useForm<{ remarks?: string }>();
    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
    const [activeId, setActiveId] = useState<number | null>(null);
    const [activeRequirementName, setActiveRequirementName] = useState<string>('');
    const [detailRequirementId, setDetailRequirementId] = useState<number | null>(null);
    const [filesModalOpen, setFilesModalOpen] = useState(false);
    const [activeFiles, setActiveFiles] = useState<any[]>([]);
    const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
    const { data: submissions, isLoading } = useQuery({
        queryKey: ['submissions'],
        queryFn: uploadService.getAll,
    });
    const { data: meData } = useQuery({
        queryKey: ['me'],
        queryFn: authService.me,
    });
    const { data: requirementDetail, isLoading: detailLoading } = useQuery({
        queryKey: ['requirement-detail', detailRequirementId],
        queryFn: () => requirementService.show(detailRequirementId as number),
        enabled: Boolean(detailRequirementId),
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, remarks }: { id: number, remarks: string }) => uploadService.approve(id, remarks),
        onSuccess: () => {
            message.success(activeRequirementName ? `Approved: ${activeRequirementName}` : 'Approved successfully');
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            setModalOpen(false);
            setActiveId(null);
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to approve.');
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, remarks }: { id: number, remarks: string }) => uploadService.reject(id, remarks),
        onSuccess: () => {
            message.success(activeRequirementName ? `Rejected: ${activeRequirementName}` : 'Rejected successfully');
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            setModalOpen(false);
            setActiveId(null);
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to reject.');
        },
    });

    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

    const filteredUploads = (submissions || []).filter((submission: any) => {
        if (statusFilter === 'all') {
            return true;
        }
        return String(submission.approval_status || '').toUpperCase() === statusFilter.toUpperCase();
    });

    const handleViewFile = async (submissionId: number, uploadId: number, file?: any) => {
        try {
            const inline = isInlineViewableFile(file);
            const { url } = await uploadService.getSignedUrl(submissionId, uploadId, inline);
            if (inline) {
                window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }

            const link = document.createElement('a');
            link.href = url;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to open file.');
        }
    };

    const getFileName = (file?: any) => {
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

    const openFilesModal = (submissionId: number, files: any[]) => {
        setActiveSubmissionId(submissionId);
        setActiveFiles(files || []);
        setFilesModalOpen(true);
    };

    const openDetails = (requirementId?: number | null) => {
        if (!requirementId) {
            message.warning('Requirement details not available.');
            return;
        }
        setDetailRequirementId(requirementId);
        setDetailOpen(true);
    };

    const openRemarks = (type: 'approve' | 'reject', id: number, requirementName?: string) => {
        setActionType(type);
        setActiveId(id);
        setActiveRequirementName(requirementName || '');
        form.resetFields();
        setModalOpen(true);
    };

    const handleSubmit = (values: { remarks?: string }) => {
        if (!activeId) {
            return;
        }
        if (actionType === 'approve') {
            approveMutation.mutate({ id: activeId, remarks: values.remarks || '' });
        } else {
            rejectMutation.mutate({ id: activeId, remarks: values.remarks || '' });
        }
    };

    const isProcessing = approveMutation.isPending || rejectMutation.isPending;
    const canApprove = Boolean(
        meData?.user?.roles?.some((role: any) =>
            role?.name === 'Super Admin' || role?.name === 'Compliance & Admin Specialist'
        )
    );
    const currentUserId = meData?.user?.id;
    const isAdmin = canApprove;

    const columns: ColumnsType<any> = [
        {
            title: 'Requirement',
            key: 'requirement',
            render: (_, record) => (
                    <div className="approvals-meta">
                        <div className="approvals-meta-title">{record.requirement?.requirement}</div>
                        <div className="approvals-meta-subtitle">{record.requirement?.agency?.name}</div>
                    </div>
                ),
            },
        {
            title: 'PIC',
            key: 'pic',
            render: (_, record) => (
                <div className="approvals-meta">
                    <div>{record.uploader?.employee_name}</div>
                    <div className="approvals-meta-subtitle">{record.uploader?.branch}</div>
                </div>
            ),
        },
        {
            title: 'Submitted At',
            dataIndex: 'upload_date',
            key: 'submitted',
            render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
        },
        {
            title: 'Status',
            dataIndex: 'approval_status',
            key: 'status',
            render: (status, record) => {
                const resolvedStatus = status || 'N/A';
                const showStatusDate = record?.approval_status && record.approval_status !== 'PENDING';
                const statusDate = showStatusDate
                    ? (record.status_change_on ? new Date(record.status_change_on).toLocaleString() : 'N/A')
                    : null;
                return (
                    <div className="approvals-status">
                        <Tag color={
                            resolvedStatus === 'APPROVED'
                                ? 'green'
                                : resolvedStatus === 'REJECTED'
                                    ? 'red'
                                    : 'gold'
                        }>
                            {resolvedStatus}
                        </Tag>
                        {statusDate ? (
                            <div className="approvals-status-date">
                                {resolvedStatus === 'APPROVED' ? 'Approved at: ' : 'Rejected at: '}{statusDate}
                            </div>
                        ) : null}
                    </div>
                );
            },
        },
        {
            title: 'Files',
            key: 'files',
            render: (_, record) => {
                if (!record.files?.length) {
                    return 'N/A';
                }
                const canViewSubmissionFiles = Boolean(
                    isAdmin
                    || record.uploaded_by_user_id === currentUserId
                    || record.approval_status === 'APPROVED'
                );
                if (!canViewSubmissionFiles) {
                    return 'N/A';
                }
                return (
                    <Button
                        size="small"
                        className="view-files-btn"
                        icon={<EyeOutlined />}
                        onClick={() => openFilesModal(record.id, record.files)}
                    >
                        View Files ({record.files.length})
                    </Button>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space>
                    <Tooltip title="View requirement details">
                        <Button
                            type="text"
                            icon={<InfoCircleOutlined />}
                            onClick={() => openDetails(record.requirement?.id)}
                        />
                    </Tooltip>
                    {canApprove ? (
                        <>
                            <Tooltip title="Approve">
                                <Button
                                    type="text"
                                    icon={<CheckOutlined />}
                                    className="approvals-action approvals-action--approve"
                                    onClick={() => openRemarks('approve', record.id, record.requirement?.requirement)}
                                    loading={isProcessing && activeId === record.id && actionType === 'approve'}
                                    disabled={isProcessing || record.approval_status !== 'PENDING'}
                                />
                            </Tooltip>
                            <Tooltip title="Reject">
                                <Button
                                    type="text"
                                    danger
                                    icon={<CloseOutlined />}
                                    onClick={() => openRemarks('reject', record.id, record.requirement?.requirement)}
                                    loading={isProcessing && activeId === record.id && actionType === 'reject'}
                                    disabled={isProcessing || record.approval_status !== 'PENDING'}
                                />
                            </Tooltip>
                        </>
                    ) : null}
                </Space>
            ),
        },
    ];

    return (
        <div className="approvals-page">
            <Title level={2} className="approvals-title">Approvals</Title>
            <Tabs
                activeKey={statusFilter}
                onChange={(key) => setStatusFilter(key as typeof statusFilter)}
                items={[
                    { key: 'pending', label: 'Pending' },
                    { key: 'approved', label: 'Approved' },
                    { key: 'rejected', label: 'Rejected' },
                    { key: 'all', label: 'All' },
                ]}
            />
            <Table
                columns={columns}
                dataSource={filteredUploads}
                rowKey="id"
                loading={isLoading}
                locale={{ emptyText: <Empty description="No pending approvals" /> }}
            />
            <Modal
                title={(
                    <Space>
                        {actionType === 'approve' ? 'Approve submission' : 'Reject submission'}
                        {isProcessing ? <Spin size="small" /> : null}
                    </Space>
                )}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                destroyOnClose
                className="approvals-modal"
                footer={(
                    <div className="approvals-modal-footer">
                        <Space>
                            <Button onClick={() => setModalOpen(false)} disabled={isProcessing}>Cancel</Button>
                            <Button
                                type="primary"
                                danger={actionType === 'reject'}
                                onClick={() => form.submit()}
                                loading={isProcessing}
                            >
                                {actionType === 'approve' ? 'Approve' : 'Reject'}
                            </Button>
                        </Space>
                    </div>
                )}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        label="Remarks"
                        name="remarks"
                        rules={actionType === 'reject' ? [{ required: true, message: 'Remarks are required to reject.' }] : []}
                    >
                        <Input.TextArea rows={4} placeholder="Add remarks (optional for approvals)" />
                    </Form.Item>
                </Form>
            </Modal>
            <Drawer
                title="Requirement Details"
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                width={760}
                destroyOnClose
                className="approvals-detail-drawer"
            >
                {detailLoading ? (
                    <Spin />
                ) : (
                    <>
                        <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="Requirement ID">
                                {requirementDetail?.req_id || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Agency">
                                {requirementDetail?.agency?.name || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Category">
                                {requirementDetail?.category || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Requirement Name" span={2}>
                                {requirementDetail?.requirement || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Description" span={2}>
                                {requirementDetail?.description || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Frequency">
                                {requirementDetail?.frequency || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Schedule">
                                {requirementDetail?.schedule || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Deadline">
                                {requirementDetail?.deadline || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Overall Compliance Status">
                                {requirementDetail?.compliance_status || 'N/A'}
                            </Descriptions.Item>
                        </Descriptions>
                        <div className="approvals-detail-section">
                            <Typography.Title level={5}>Past Submissions</Typography.Title>
                            {requirementDetail?.submissions && requirementDetail.submissions.length > 0 ? (
                                <Space direction="vertical" size={12} className="approvals-upload-list">
                                    {requirementDetail.submissions.map((submission: any) => (
                                        <div key={submission.id} className="approvals-upload-item">
                                            <div className="approvals-upload-row">
                                                <div>
                                                    <div className="approvals-upload-title">{submission.submission_id}</div>
                                                    <div className="approvals-upload-subtitle">
                                                        {submission.uploader?.employee_name || submission.uploader_email || 'Unknown'} ·{' '}
                                                        {submission.upload_date ? new Date(submission.upload_date).toLocaleString() : 'N/A'}
                                                    </div>
                                                </div>
                                                <Tag color={
                                                    submission.approval_status === 'APPROVED'
                                                        ? 'green'
                                                        : submission.approval_status === 'REJECTED'
                                                            ? 'red'
                                                            : 'gold'
                                                }>
                                                    {submission.approval_status}
                                                </Tag>
                                            </div>
                                            <div className="approvals-submission-card">
                                                <div className="approvals-submission-grid">
                                                    <div className="approvals-submission-item">
                                                        <span className="approvals-submission-label">Uploaded by</span>
                                                        <span className="approvals-submission-value">
                                                            {submission.uploader?.employee_name || submission.uploader_email || 'Unknown'}
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
                                                            <div className="approvals-submission-item">
                                                                <span className="approvals-submission-label">Uploaded for</span>
                                                                <span className="approvals-submission-value">{uploadedFor}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="approvals-submission-item">
                                                        <span className="approvals-submission-label">Uploaded at</span>
                                                        <span className="approvals-submission-value">
                                                            {submission.upload_date ? new Date(submission.upload_date).toLocaleString() : 'N/A'}
                                                        </span>
                                                    </div>
                                                    {submission.deadline_at_upload ? (
                                                        <div className="approvals-submission-item">
                                                            <span className="approvals-submission-label">Submitted for Deadline Set On</span>
                                                            <span className="approvals-submission-value">
                                                                {submission.deadline_at_upload ? new Date(submission.deadline_at_upload).toLocaleDateString() : 'N/A'}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    {submission.approval_status !== 'PENDING' ? (
                                                        <div className="approvals-submission-item">
                                                            <span className="approvals-submission-label">
                                                                {submission.approval_status === 'APPROVED' ? 'Approved at' : 'Rejected at'}
                                                            </span>
                                                            <span className="approvals-submission-value">
                                                                {submission.status_change_on ? new Date(submission.status_change_on).toLocaleString() : 'N/A'}
                                                            </span>
                                                        </div>
                                                    ) : null}
                                                    {submission.admin_remarks ? (
                                                        <div className="approvals-submission-item approvals-submission-item--full">
                                                            <span className="approvals-submission-label">Admin remarks</span>
                                                            <span className="approvals-submission-value">{submission.admin_remarks}</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <div className="approvals-submission-actions">
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
                                                                onClick={() => openFilesModal(submission.id, submission.files)}
                                                            >
                                                                View Files ({submission.files.length})
                                                            </Button>
                                                        );
                                                    })() : null}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </Space>
                ) : (
                    <Empty description="No submissions found" />
                )}
            </div>
        </>
    )}
</Drawer>
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
                                            handleViewFile(activeSubmissionId, file.id, file);
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

export default ApprovalsPage;
