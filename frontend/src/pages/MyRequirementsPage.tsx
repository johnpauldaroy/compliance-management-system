import { List, Card, Button, Tag, Space, Typography, Drawer, Descriptions, Upload, message, Modal, Form, Input, Select } from 'antd';
import { UploadOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { requirementService, uploadService } from '../services/apiService';
import { authService } from '../services/authService';
import './MyRequirementsPage.css';

const { Text, Title } = Typography;

const MyRequirementsPage = () => {
    const [form] = Form.useForm();
    const [detailId, setDetailId] = useState<number | null>(null);
    const [selectedRequirement, setSelectedRequirement] = useState<any>(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadRequirementId, setUploadRequirementId] = useState<number | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const { data: requirements, isLoading } = useQuery({
        queryKey: ['my-requirements'],
        queryFn: requirementService.getMine,
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to load requirements.');
        },
    });

    const { data: meData } = useQuery({
        queryKey: ['me'],
        queryFn: authService.me,
    });

    const { data: detailData, isLoading: isDetailLoading, refetch: refetchDetails } = useQuery({
        queryKey: ['requirement', detailId],
        queryFn: () => requirementService.show(detailId as number),
        enabled: Boolean(detailId),
    });

    const canEditApproval = useMemo(() => {
        const roles = meData?.user?.roles || [];
        return roles.some((role: any) =>
            role?.name === 'Compliance & Admin Specialist' || role?.name === 'Admin Specialist'
        );
    }, [meData]);

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

            <List
                grid={{ gutter: 16, column: 1 }}
                dataSource={requirements}
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
                                            Deadline: {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'N/A'}
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
                                    {data.deadline || 'N/A'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Compliance Status" span={2}>
                                    {getComplianceDisplay(data.compliance_status)}
                                </Descriptions.Item>
                            </Descriptions>

                            <div style={{ marginTop: 24 }}>
                                <Title level={5}>Uploads</Title>
                                <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    onClick={() => {
                                        setUploadRequirementId(data.id);
                                        setUploadFile(null);
                                        form.resetFields();
                                        setUploadModalOpen(true);
                                    }}
                                    style={{ marginBottom: 12 }}
                                >
                                    Upload
                                </Button>
                                <List
                                    dataSource={data.uploads || []}
                                    locale={{ emptyText: 'No uploads yet.' }}
                                    renderItem={(upload) => (
                                        <List.Item>
                                            <Card style={{ width: '100%' }}>
                                                <Space size="large">
                                                    <div>
                                                        <Text strong>{upload.upload_id}</Text>
                                                        <div>Uploaded by: {upload.uploader?.employee_name || upload.uploader_email}</div>
                                                        <div>Uploaded at: {upload.upload_date ? new Date(upload.upload_date).toLocaleString() : 'N/A'}</div>
                                                    </div>
                                                    <Tag color={upload.approval_status === 'APPROVED' ? 'success' : upload.approval_status === 'REJECTED' ? 'error' : 'processing'}>
                                                        {upload.approval_status}
                                                    </Tag>
                                                </Space>
                                            </Card>
                                        </List.Item>
                                    )}
                                />
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
                            if (values.admin_remarks) {
                                formData.append('admin_remarks', values.admin_remarks);
                            }
                        }
                        uploadService.upload(formData)
                            .then(() => {
                                message.success('File uploaded.');
                                setUploadModalOpen(false);
                                refetchDetails();
                            })
                            .catch((error: any) => {
                                message.error(error.response?.data?.message || 'Failed to upload file.');
                            });
                    }}
                >
                    <Form.Item label="Document File" required>
                        <Upload
                            beforeUpload={(file) => {
                                setUploadFile(file);
                                return false;
                            }}
                            maxCount={1}
                        >
                            <Button icon={<UploadOutlined />}>Select File</Button>
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
