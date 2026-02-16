import { Table, Button, Space, message, Typography, Empty, Drawer, Form, Input } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadService } from '../services/apiService';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import './ApprovalsPage.css';

const { Title } = Typography;

const ApprovalsPage = () => {
    const queryClient = useQueryClient();
    const [form] = Form.useForm<{ remarks?: string }>();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
    const [activeId, setActiveId] = useState<number | null>(null);
    const [activeRequirementName, setActiveRequirementName] = useState<string>('');
    const { data: uploads, isLoading } = useQuery({
        queryKey: ['uploads'],
        queryFn: uploadService.getAll,
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, remarks }: { id: number, remarks: string }) => uploadService.approve(id, remarks),
        onSuccess: () => {
            message.success(activeRequirementName ? `Approved: ${activeRequirementName}` : 'Approved successfully');
            queryClient.invalidateQueries({ queryKey: ['uploads'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to approve.');
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, remarks }: { id: number, remarks: string }) => uploadService.reject(id, remarks),
        onSuccess: () => {
            message.success(activeRequirementName ? `Rejected: ${activeRequirementName}` : 'Rejected successfully');
            queryClient.invalidateQueries({ queryKey: ['uploads'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to reject.');
        },
    });

    const pendingUploads = uploads?.filter((upload) => upload.approval_status === 'PENDING');

    const handleViewFile = async (uploadId: number) => {
        try {
            const { url } = await uploadService.getSignedUrl(uploadId, true);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to open file.');
        }
    };

    const openRemarks = (type: 'approve' | 'reject', id: number, requirementName?: string) => {
        setActionType(type);
        setActiveId(id);
        setActiveRequirementName(requirementName || '');
        form.resetFields();
        setDrawerOpen(true);
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
        setDrawerOpen(false);
    };

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
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space>
                    <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewFile(record.id)}>
                        View File
                    </Button>
                    <Button
                        type="text"
                        icon={<CheckOutlined />}
                        className="approvals-action approvals-action--approve"
                        onClick={() => openRemarks('approve', record.id, record.requirement?.requirement)}
                    />
                    <Button
                        type="text"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => openRemarks('reject', record.id, record.requirement?.requirement)}
                    />
                </Space>
            ),
        },
    ];

    return (
        <div className="approvals-page">
            <Title level={2} className="approvals-title">Pending Approvals</Title>
            <Table
                columns={columns}
                dataSource={pendingUploads}
                rowKey="id"
                loading={isLoading}
                locale={{ emptyText: <Empty description="No pending approvals" /> }}
            />
            <Drawer
                title={actionType === 'approve' ? 'Approve submission' : 'Reject submission'}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={520}
                destroyOnClose
                className="approvals-drawer"
                footer={(
                    <div className="approvals-drawer-footer">
                        <Space>
                            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
                            <Button
                                type="primary"
                                danger={actionType === 'reject'}
                                onClick={() => form.submit()}
                                loading={approveMutation.isPending || rejectMutation.isPending}
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
            </Drawer>
        </div>
    );
};

export default ApprovalsPage;
