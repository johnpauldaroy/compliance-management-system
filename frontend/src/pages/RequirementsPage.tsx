import { Table, Button, Tag, Drawer, Form, Input, Select, Space, message, Typography, Row, Col, Upload, Tooltip, Descriptions, Modal } from 'antd';
import { PlusOutlined, InfoCircleOutlined, EditOutlined, DeleteOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { agencyService, branchUnitDepartmentService, positionService, requirementService, userService } from '../services/apiService';
import type { ColumnsType } from 'antd/es/table';
import type { Agency, BranchUnitDepartment, PaginatedResponse, Position, Requirement, User } from '../types';
import './RequirementsPage.css';

const { Text } = Typography;

const toIdList = (value?: string | null) =>
    value
        ? value.split(';').map((item) => Number(item.trim())).filter(Boolean)
        : [];

const getPositionNames = (ids?: string | null, positions?: Position[]) => {
    const list = toIdList(ids);
    if (!list.length) {
        return '';
    }
    const map = new Map((positions || []).map((position) => [position.id, position.name]));
    return list.map((id) => map.get(id)).filter(Boolean).join('; ');
};

const getBranchUnitNames = (ids?: string | null, units?: BranchUnitDepartment[]) => {
    const list = toIdList(ids);
    if (!list.length) {
        return '';
    }
    const map = new Map((units || []).map((unit) => [unit.id, unit.name]));
    return list.map((id) => map.get(id)).filter(Boolean).join('; ');
};

const getPersonInChargeNames = (ids?: string | null, users?: User[]) => {
    const list = toIdList(ids);
    if (!list.length) {
        return '';
    }
    const map = new Map((users || []).map((user) => [user.id, user.employee_name]));
    return list.map((id) => map.get(id)).filter(Boolean).join('; ');
};

type RequirementFormValues = {
    req_id?: string;
    agency_id: number;
    category: string;
    requirement: string;
    description?: string;
    position_ids: number[];
    branch_unit_department_ids: number[];
    person_in_charge_user_ids: number[];
    frequency: string;
    schedule: string;
    deadline?: string;
};

type RequirementPayload = {
    req_id?: string;
    agency_id: number;
    category: string;
    requirement: string;
    description?: string;
    position_ids?: string | null;
    branch_unit_department_ids?: string | null;
    person_in_charge_user_ids?: string | null;
    frequency: string;
    schedule: string;
    deadline?: string;
};

const RequirementsPage = () => {
    const [form] = Form.useForm<RequirementFormValues>();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const getComplianceDisplay = (status?: string) =>
        status ?? 'N/A';

    const { data: requirementsResponse, isLoading, isFetching, refetch, error: requirementsError } = useQuery<PaginatedResponse<Requirement>>({
        queryKey: ['requirements', currentPage, pageSize, searchTerm],
        queryFn: () => requirementService.getAll({
            page: currentPage,
            per_page: pageSize,
            search: searchTerm.trim() || undefined,
        }),
        placeholderData: keepPreviousData,
    });

    const { data: agencies } = useQuery({
        queryKey: ['agencies'],
        queryFn: agencyService.getAll,
    });

    const { data: branchUnits } = useQuery({
        queryKey: ['branch-unit-departments'],
        queryFn: branchUnitDepartmentService.getAll,
    });

    const { data: positions } = useQuery({
        queryKey: ['positions'],
        queryFn: positionService.getAll,
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: userService.getAll,
    });

    const { data: detailData, isLoading: isDetailLoading } = useQuery<Requirement>({
        queryKey: ['requirement', detailId],
        queryFn: () => requirementService.show(detailId as number),
        enabled: Boolean(detailId),
    });

    const createRequirement = useMutation({
        mutationFn: (payload: RequirementPayload) => requirementService.create(payload),
        onSuccess: () => {
            message.success('Requirement added.');
            setIsDrawerOpen(false);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to add requirement.');
        },
    });

    const updateRequirement = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Partial<RequirementPayload> }) =>
            requirementService.update(id, payload),
        onSuccess: () => {
            message.success('Requirement updated.');
            setIsDrawerOpen(false);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update requirement.');
        },
    });

    const deleteRequirement = useMutation({
        mutationFn: (id: number) => requirementService.delete(id),
        onSuccess: () => {
            message.success('Requirement deleted.');
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to delete requirement.');
        },
    });

    const importRequirements = useMutation({
        mutationFn: requirementService.import,
        onSuccess: (response) => {
            const created = response?.created ?? 0;
            const errors = response?.errors ?? [];
            if (errors.length) {
                message.warning(`Imported ${created} rows, ${errors.length} failed.`);
            } else {
                message.success(`Imported ${created} rows.`);
            }
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to import requirements.');
        },
    });

    const handleAdd = () => {
        setEditingRequirement(null);
        form.resetFields();
        form.setFieldsValue({ req_id: 'Select agency' });
        setIsDrawerOpen(true);
    };

    const handleEdit = (record: Requirement) => {
        setEditingRequirement(record);
        form.setFieldsValue({
            req_id: record.req_id,
            agency_id: record.agency_id,
            category: record.category,
            requirement: record.requirement,
            description: record.description || '',
            position_ids: toIdList(record.position_ids),
            branch_unit_department_ids: toIdList(record.branch_unit_department_ids),
            person_in_charge_user_ids: toIdList(record.person_in_charge_user_ids),
            frequency: record.frequency,
            schedule: record.schedule,
        });
        setIsDrawerOpen(true);
    };

    const handleSubmit = (values: RequirementFormValues) => {
        const payload: RequirementPayload = {
            ...values,
            position_ids: values.position_ids.length ? values.position_ids.join(';') : null,
            branch_unit_department_ids: values.branch_unit_department_ids.length ? values.branch_unit_department_ids.join(';') : null,
            person_in_charge_user_ids: values.person_in_charge_user_ids.length ? values.person_in_charge_user_ids.join(';') : null,
        };
        if (editingRequirement) {
            updateRequirement.mutate({ id: editingRequirement.id, payload });
            return;
        }
        createRequirement.mutate(payload);
    };

    const handleDelete = (record: Requirement) => {
        Modal.confirm({
            title: `Delete ${record.req_id}?`,
            content: 'This action cannot be undone.',
            okText: 'Delete',
            okType: 'danger',
            onOk: () => deleteRequirement.mutate(record.id),
        });
    };

    const columns: ColumnsType<Requirement> = [
        {
            title: 'Req ID',
            dataIndex: 'req_id',
            key: 'req_id',
            width: 120,
            render: (value) => <div className="requirements-cell-wrap">{value}</div>,
        },
        {
            title: 'Requirement Name',
            dataIndex: 'requirement',
            key: 'requirement',
            width: 260,
            render: (text) => <span className="requirements-cell-name">{text}</span>,
        },
        {
            title: 'Frequency',
            dataIndex: 'frequency',
            key: 'frequency',
            render: (freq) => (
                <div className="requirements-cell-wrap">
                    <Tag color="blue" className="requirements-tag">
                        {freq}
                    </Tag>
                </div>
            ),
            width: 140,
        },
        {
            title: 'Compliance Status',
            dataIndex: 'compliance_status',
            key: 'compliance_status',
            render: (_, record) => (
                <div className="requirements-cell-wrap">
                    {getComplianceDisplay(record.compliance_status)}
                </div>
            ),
            width: 160,
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_, record) => (
                <Space wrap>
                    <Tooltip title="Details">
                        <Button
                            type="text"
                            icon={<InfoCircleOutlined />}
                            className="requirements-action requirements-action--info"
                            onClick={() => setDetailId(record.id)}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            className="requirements-action requirements-action--warning"
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Delete">
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            className="requirements-action requirements-action--danger"
                            onClick={() => handleDelete(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    useEffect(() => {
        if (!requirementsError) {
            return;
        }
        const error = requirementsError as any;
        message.error(error.response?.data?.message || 'Failed to load requirements.');
    }, [requirementsError]);

    const requirements = useMemo<Requirement[]>(() => requirementsResponse?.data ?? [], [requirementsResponse]);

    const picUsers = useMemo(() => {
        const users: User[] = usersData?.data || [];
        return users.filter((user) => {
            const roleName = user.roles?.[0]?.name || '';
            return (
                roleName === 'Person-In-Charge (PIC)' ||
                roleName === 'Compliance & Admin Specialist' ||
                roleName === 'Admin Specialist' ||
                roleName === 'Person-in-Charge'
            );
        });
    }, [usersData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="requirements-page">
            <div className="requirements-header">
                <Typography.Title level={2} className="requirements-title">Requirements</Typography.Title>
            </div>
            <div className="requirements-toolbar">
                <Input
                    placeholder="Search requirements"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    allowClear
                    className="requirements-search"
                />
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={isFetching}
                        onClick={async () => {
                            const key = 'requirements-refresh';
                            message.loading({ content: 'Data is refreshing...', key });
                            await refetch();
                            message.success({ content: 'Data is up to date.', key, duration: 2 });
                        }}
                    />
                </Space>
                <div className="requirements-toolbar-right">
                    <Space>
                        <Upload
                            accept=".csv,.xlsx"
                            showUploadList={false}
                            beforeUpload={(file) => {
                                importRequirements.mutate(file);
                                return false;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>Import</Button>
                        </Upload>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Add Requirement
                        </Button>
                    </Space>
                </div>
            </div>
            <Table
                columns={columns}
                dataSource={requirements}
                rowKey="id"
                loading={isLoading}
                tableLayout="fixed"
                pagination={{
                    current: currentPage,
                    pageSize,
                    total: requirementsResponse?.total || 0,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '25', '50', '100'],
                    onChange: (page, size) => {
                        setCurrentPage(page);
                        if (size && size !== pageSize) {
                            setPageSize(size);
                        }
                    },
                }}
            />
            <Drawer
                title={editingRequirement ? 'Edit Requirement' : 'Add Requirement'}
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                destroyOnClose
                width={840}
                className="requirements-drawer"
                footer={(
                    <div className="requirements-drawer-footer">
                        <Space>
                            <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
                            <Button
                                type="primary"
                                onClick={() => form.submit()}
                                loading={createRequirement.isPending || updateRequirement.isPending}
                            >
                                {editingRequirement ? 'Save Changes' : 'Create Requirement'}
                            </Button>
                        </Space>
                    </div>
                )}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Row gutter={12}>
                        <Col span={4}>
                            <Form.Item
                                label="Requirement ID"
                                name="req_id"
                            >
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={16}>
                            <Form.Item
                                label="Agency"
                                name="agency_id"
                                rules={[{ required: true, message: 'Agency is required.' }]}
                            >
                                <Select
                                    options={(agencies || []).map((agency: Agency) => ({
                                        value: agency.id,
                                        label: `${agency.agency_id} - ${agency.name}`,
                                    }))}
                                    showSearch
                                    optionFilterProp="label"
                                    onChange={(value) => {
                                        if (!editingRequirement) {
                                            const agency = (agencies || []).find((item: Agency) => item.id === value);
                                            if (agency) {
                                                const max = (requirements || [])
                                                    .filter((req) => req.agency_id === value)
                                                    .map((req: Requirement) => {
                                                        const match = req.req_id?.match(/-(\d{3,})$/);
                                                        return match ? parseInt(match[1], 10) : 0;
                                                    })
                                                    .reduce((acc: number, num: number) => Math.max(acc, num), 0);
                                                const next = String(max + 1).padStart(3, '0');
                                                form.setFieldsValue({ req_id: `${agency.agency_id}-${next}`.toUpperCase() });
                                            }
                                        }
                                    }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item
                                label="Category"
                                name="category"
                                rules={[{ required: true, message: 'Category is required.' }]}
                            >
                                <Select
                                    options={[
                                        'Permit',
                                        'Meeting',
                                        'Report',
                                        'Certification',
                                        'Policy',
                                        'Plan',
                                        'Dues',
                                        'Contract',
                                        'Chart',
                                        'License',
                                    ].map((category) => ({ label: category, value: category }))}
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) =>
                                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item
                        label="Requirement Name"
                        name="requirement"
                        rules={[{ required: true, message: 'Requirement name is required.' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item label="Description" name="description">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item
                                label="Assigned To"
                                name="position_ids"
                                rules={[{ required: true, message: 'Assigned to is required.' }]}
                            >
                                <Select
                                    mode="multiple"
                                    maxTagCount="responsive"
                                    options={(positions || []).map((position: Position) => ({
                                        value: position.id,
                                        label: position.name,
                                    }))}
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Select position(s)"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Branch/Unit/Department In Charge"
                                name="branch_unit_department_ids"
                                rules={[{ required: true, message: 'Branch/unit/department is required.' }]}
                            >
                                <Select
                                    mode="multiple"
                                    maxTagCount="responsive"
                                    options={(branchUnits || []).map((unit: BranchUnitDepartment) => ({
                                        value: unit.id,
                                        label: unit.name,
                                    }))}
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Select branch/unit/department(s)"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Person-In-Charge" name="person_in_charge_user_ids">
                        <Select
                            mode="multiple"
                            maxTagCount="responsive"
                            options={picUsers.map((user) => ({
                                value: user.id,
                                label: `${user.employee_name} (${user.user_id})`,
                            }))}
                            showSearch
                            optionFilterProp="label"
                            placeholder="Select person-in-charge"
                        />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item
                                label="Frequency"
                                name="frequency"
                                rules={[{ required: true, message: 'Frequency is required.' }]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Schedule"
                                name="schedule"
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Deadline" name="deadline">
                        <Input type="date" />
                    </Form.Item>
                </Form>
            </Drawer>
            <Drawer
                title="Requirement Details"
                open={Boolean(detailId)}
                onClose={() => setDetailId(null)}
                width={840}
                className="requirements-drawer"
                destroyOnClose
            >
                {isDetailLoading ? (
                    <Text type="secondary">Loading...</Text>
                ) : (
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="Requirement ID">
                            {detailData?.req_id || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Agency">
                            {detailData?.agency?.name || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Category">
                            {detailData?.category || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Requirement Name" span={2}>
                            {detailData?.requirement || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Description" span={2}>
                            {detailData?.description || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Assigned To">
                            {getPositionNames(detailData?.position_ids, positions) || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Branch/Unit/Department In Charge">
                            {getBranchUnitNames(detailData?.branch_unit_department_ids, branchUnits) || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Person-In-Charge" span={2}>
                            {detailData?.assignments && detailData.assignments.length > 0 ? (
                                <div className="requirements-assignments-list">
                                    {detailData.assignments.map(asgn => (
                                        <div key={asgn.id} className="requirements-assignment-item">
                                            <Space>
                                                <Text strong>{asgn.user?.employee_name}</Text>
                                                <Tag color={
                                                    asgn.compliance_status === 'APPROVED' ? 'green' :
                                                        asgn.compliance_status === 'REJECTED' ? 'red' :
                                                            asgn.compliance_status === 'SUBMITTED' ? 'blue' :
                                                                asgn.compliance_status === 'OVERDUE' ? 'orange' : 'default'
                                                }>
                                                    {asgn.compliance_status}
                                                </Tag>
                                                {asgn.last_submitted_at && (
                                                    <Text type="secondary">
                                                        Submitted: {new Date(asgn.last_submitted_at).toLocaleDateString()}
                                                    </Text>
                                                )}
                                            </Space>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                getPersonInChargeNames(detailData?.person_in_charge_user_ids, picUsers) || 'N/A'
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Frequency">
                            {detailData?.frequency || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Schedule">
                            {detailData?.schedule || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Deadline">
                            {detailData?.deadline || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Overall Compliance Status" span={2}>
                            <Tag color={
                                detailData?.compliance_status?.includes('100%') ? 'green' :
                                    detailData?.compliance_status?.includes('Late') ? 'red' : 'blue'
                            }>
                                {getComplianceDisplay(detailData?.compliance_status)}
                            </Tag>
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Drawer>
        </div>
    );
};

export default RequirementsPage;
