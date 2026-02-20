import { List, Card, Button, Tag, Space, Typography, Drawer, Descriptions, Upload, message, Modal, Form, Input, Select, Collapse, Tooltip, DatePicker } from 'antd';
import { UploadOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { requirementService, uploadService } from '../services/apiService';
import { authService } from '../services/authService';
import type { Requirement, Upload as UploadRecord, User } from '../types';
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

type MeResponse = { user: User };

const MyRequirementsPage = () => {
    const [form] = Form.useForm();
    const [detailId, setDetailId] = useState<number | null>(null);
    const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadRequirementId, setUploadRequirementId] = useState<number | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { data: requirements, isLoading, error: requirementsError } = useQuery<Requirement[]>({
        queryKey: ['my-requirements'],
        queryFn: () => requirementService.getMine(),
    });

    const { data: meData } = useQuery<MeResponse>({
        queryKey: ['me'],
        queryFn: () => authService.me(),
    });

    const { data: detailData, isLoading: isDetailLoading, refetch: refetchDetails } = useQuery<Requirement>({
        queryKey: ['requirement', detailId],
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

    const isAdmin = useMemo(() => {
        const roles = meData?.user?.roles || [];
        return roles.some((role: any) =>
            role?.name === 'Compliance & Admin Specialist' || role?.name === 'Super Admin'
        );
    }, [meData]);

    const canEditApproval = isAdmin;

    const getComplianceDisplay = (status?: string) =>
        status ?? 'N/A';

    const getStatusColor = (status?: string) => {
        const normalized = (status || '').trim().toLowerCase();
        if (normalized.startsWith('complied')) {
            return 'success';
        }
        if (normalized.startsWith('late')) {
            return 'error';
        }
        if (normalized.startsWith('pending')) {
            return 'processing';
        }
        if (!normalized) {
            return 'default';
        }
        return 'warning';
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
                onClose={() => setDetailId(null)}
                width={840}
                destroyOnClose
                className="requirements-drawer"
            >
                {(() => {
                    const data = detailData || selectedRequirement;
                    if (isDetailLoading) {
                        return <Text type="secondary">Loading...</Text>;
                    }
                    if (!data) {
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
                                <Descriptions.Item label="Deadline">
                                    {formatPhDate(data.deadline)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Compliance Status" span={2}>
                                    {getComplianceDisplay(data.compliance_status)}
                                </Descriptions.Item>
                            </Descriptions>

                            <div style={{ marginTop: 24 }}>
                                <Title level={5}>Uploads</Title>
                                {(() => {
                                    const uploads = data.uploads ?? [];
                                    const deadlineKey = toPhDateKey(data.deadline);
                                    const approvedForDeadline = Boolean(
                                        deadlineKey
                                            && uploads.some((upload) =>
                                                upload.approval_status === 'APPROVED'
                                                && toPhDateKey(upload.deadline_at_upload) === deadlineKey
                                            )
                                    );
                                    const uploadTooltip = !isAdmin && !deadlineKey
                                        ? 'Set a deadline to enable uploads.'
                                        : !isAdmin && approvedForDeadline
                                            ? 'An approved upload already exists for this deadline.'
                                            : '';
                                    const uploadDisabled = !isAdmin && (!deadlineKey || approvedForDeadline);
                                    return (
                                        <>
                                            {uploadDisabled ? (
                                                <Tooltip title={uploadTooltip} placement="top">
                                                    <Button
                                                        type="primary"
                                                        icon={<UploadOutlined />}
                                                        onClick={() => {
                                                            setUploadRequirementId(data.id);
                                                            setUploadFile(null);
                                                            form.resetFields();
                                                            if (isAdmin && data.deadline) {
                                                                form.setFieldsValue({ deadline_at_upload: dayjs(`${data.deadline}T00:00:00+08:00`) });
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
                                                        setUploadFile(null);
                                                        form.resetFields();
                                                        if (isAdmin && data.deadline) {
                                                            form.setFieldsValue({ deadline_at_upload: dayjs(`${data.deadline}T00:00:00+08:00`) });
                                                        }
                                                        setUploadModalOpen(true);
                                                    }}
                                                    style={{ marginBottom: 12 }}
                                                >
                                                    Upload
                                                </Button>
                                            )}
                                            {(!uploads.length) ? (
                                                <div style={{ textAlign: 'center', marginTop: 8 }}>
                                                    <Text type="secondary">No uploads yet.</Text>
                                                </div>
                                            ) : null}
                                            {uploads.length ? (() => {
                                                const grouped = uploads.reduce<Record<string, UploadRecord[]>>((acc, upload) => {
                                                    const key = upload.deadline_at_upload ? toPhDateKey(upload.deadline_at_upload) : 'no-deadline';
                                                    acc[key] = acc[key] || [];
                                                    acc[key].push(upload);
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
                                                            <List<UploadRecord>
                                                                dataSource={items}
                                                                renderItem={(upload) => (
                                                                    <List.Item>
                                                                        <Card style={{ width: '100%' }}>
                                                                            <Space size="large">
                                                                                <div>
                                                                                    <Text strong>{upload.upload_id}</Text>
                                                                                    <div>Uploaded by: {upload.uploader?.employee_name || upload.uploader_email}</div>
                                                                                    <div>Uploaded at: {upload.upload_date ? new Date(upload.upload_date).toLocaleString() : 'N/A'}</div>
                                                                                    {upload.approval_status !== 'PENDING' ? (
                                                                                        <div>
                                                                                            {upload.approval_status === 'APPROVED' ? 'Approved' : 'Rejected'} at:{' '}
                                                                                            {upload.status_change_on ? new Date(upload.status_change_on).toLocaleString() : 'N/A'}
                                                                                        </div>
                                                                                    ) : null}
                                                                                </div>
                                                                                <Tag color={upload.approval_status === 'APPROVED' ? 'success' : upload.approval_status === 'REJECTED' ? 'error' : 'processing'}>
                                                                                    {upload.approval_status}
                                                                                </Tag>
                                                                            </Space>
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
                        if (!uploadFile) {
                            message.error('Please select a file to upload.');
                            return;
                        }
                        const formData = new FormData();
                        formData.append('requirement_id', String(uploadRequirementId));
                        formData.append('doc_file', uploadFile);
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
                            accept="application/pdf,.pdf"
                            beforeUpload={(file) => {
                                if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                                    message.error('Only PDF files are allowed.');
                                    return Upload.LIST_IGNORE;
                                }
                                setUploadFile(file);
                                return false;
                            }}
                            maxCount={1}
                        >
                            <Button icon={<UploadOutlined />} disabled={isUploading}>Select File</Button>
                        </Upload>
                    </Form.Item>
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
        </div>
    );
};

export default MyRequirementsPage;
