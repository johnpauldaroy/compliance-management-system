import { Table, Button, Tag, Drawer, Form, Input, Select, Space, message, Typography, Row, Col, Upload, Tooltip, Descriptions, Modal, Collapse, DatePicker } from 'antd';
import { PlusOutlined, InfoCircleOutlined, EditOutlined, DeleteOutlined, UploadOutlined, ReloadOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import type { SortOrder } from 'antd/es/table/interface';
import { useLocation } from 'react-router-dom';
import { agencyService, branchUnitDepartmentService, positionService, requirementService, uploadService, userService } from '../services/apiService';
import { authService } from '../services/authService';
import type { ColumnsType } from 'antd/es/table';
import type { Agency, BranchUnitDepartment, PaginatedResponse, Position, Requirement, Upload as UploadRecord, User } from '../types';
import './RequirementsPage.css';

const { Text } = Typography;

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
    const location = useLocation();
    const [form] = Form.useForm<RequirementFormValues>();
    const [uploadForm] = Form.useForm();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'na' | 'pending' | 'complied' | 'overdue'>('all');
    const [sortField, setSortField] = useState<'id' | 'req_id' | 'requirement'>('id');
    const [sortOrder, setSortOrder] = useState<SortOrder>('ascend');

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadRequirementId, setUploadRequirementId] = useState<number | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

    const statusFilterFromUrl = useMemo(() => {
        const rawStatus = new URLSearchParams(location.search).get('status')?.toLowerCase();
        if (rawStatus === 'compliant' || rawStatus === 'pending' || rawStatus === 'overdue' || rawStatus === 'na' || rawStatus === 'complied') {
            return rawStatus === 'compliant' ? 'complied' : rawStatus;
        }
        return undefined;
    }, [location.search]);

    useEffect(() => {
        if (statusFilterFromUrl) {
            setStatusFilter(statusFilterFromUrl as typeof statusFilter);
        }
    }, [statusFilterFromUrl]);

    const getComplianceDisplay = (status?: string) =>
        status ?? 'N/A';

    const { data: requirementsResponse, isLoading, isFetching, refetch, error: requirementsError } = useQuery<PaginatedResponse<Requirement>>({
        queryKey: ['requirements', currentPage, pageSize, searchTerm, statusFilter, sortField, sortOrder],
        queryFn: () => requirementService.getAll({
            page: currentPage,
            per_page: pageSize,
            search: searchTerm.trim() || undefined,
            status: statusFilter === 'all' ? undefined : statusFilter,
            sort_by: sortField,
            sort_dir: sortOrder === 'descend' ? 'desc' : 'asc',
        }),
        placeholderData: keepPreviousData,
    });

    const { data: agencies } = useQuery({
        queryKey: ['agencies', 'active'],
        queryFn: () => agencyService.getAll({ active_only: true }),
    });

    const { data: agenciesAll } = useQuery({
        queryKey: ['agencies', 'all'],
        queryFn: () => agencyService.getAll(),
        enabled: Boolean(editingRequirement),
    });

    const { data: branchUnits } = useQuery({
        queryKey: ['branch-unit-departments', 'active'],
        queryFn: () => branchUnitDepartmentService.getAll({ active_only: true }),
    });

    const { data: branchUnitsAll } = useQuery({
        queryKey: ['branch-unit-departments', 'all'],
        queryFn: () => branchUnitDepartmentService.getAll(),
        enabled: Boolean(editingRequirement),
    });

    const { data: positions } = useQuery({
        queryKey: ['positions', 'active'],
        queryFn: () => positionService.getAll({ active_only: true }),
    });

    const { data: positionsAll } = useQuery({
        queryKey: ['positions', 'all'],
        queryFn: () => positionService.getAll(),
        enabled: Boolean(editingRequirement),
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: userService.getAll,
    });

    const { data: detailData, isLoading: isDetailLoading, refetch: refetchDetails } = useQuery<Requirement>({
        queryKey: ['requirement', detailId],
        queryFn: () => requirementService.show(detailId as number),
        enabled: Boolean(detailId),
    });

    const { data: meData } = useQuery<{ user: User }>({
        queryKey: ['me'],
        queryFn: () => authService.me(),
    });

    const isAdmin = useMemo(() => {
        const roles = meData?.user?.roles || [];
        return roles.some((role: any) =>
            role?.name === 'Compliance & Admin Specialist' || role?.name === 'Super Admin'
        );
    }, [meData]);

    const handleViewUpload = async (uploadId: number) => {
        try {
            const { url } = await uploadService.getSignedUrl(uploadId, true);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to open file.');
        }
    };

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
            sorter: true,
            sortOrder: sortField === 'req_id' ? sortOrder : undefined,
        },
        {
            title: 'Requirement Name',
            dataIndex: 'requirement',
            key: 'requirement',
            width: 260,
            render: (text) => <span className="requirements-cell-name">{text}</span>,
            sorter: true,
            sortOrder: sortField === 'requirement' ? sortOrder : undefined,
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

    const agencyOptions = useMemo(() => {
        const list = editingRequirement ? (agenciesAll || agencies || []) : (agencies || []);
        return list.map((agency: Agency) => ({
            value: agency.id,
            label: `${agency.agency_id} - ${agency.name}${agency.is_active === false ? ' (Inactive)' : ''}`,
        }));
    }, [agencies, agenciesAll, editingRequirement]);

    const positionOptions = useMemo(() => {
        const list = editingRequirement ? (positionsAll || positions || []) : (positions || []);
        return list.map((position: Position) => ({
            value: position.id,
            label: `${position.name}${position.is_active === false ? ' (Inactive)' : ''}`,
        }));
    }, [positions, positionsAll, editingRequirement]);

    const branchUnitOptions = useMemo(() => {
        const list = editingRequirement ? (branchUnitsAll || branchUnits || []) : (branchUnits || []);
        return list.map((unit: BranchUnitDepartment) => ({
            value: unit.id,
            label: `${unit.name}${unit.is_active === false ? ' (Inactive)' : ''}`,
        }));
    }, [branchUnits, branchUnitsAll, editingRequirement]);

    const picUsers = useMemo(() => {
        const users: User[] = usersData?.data || [];
        return users.filter((user) => {
            const roleName = user.roles?.[0]?.name || '';
            return (
                roleName === 'Person-In-Charge (PIC)' ||
                roleName === 'Compliance & Admin Specialist' ||
                roleName === 'Person-in-Charge'
            );
        });
    }, [usersData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

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
                <Select
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value)}
                    options={[
                        { label: 'All statuses', value: 'all' },
                        { label: 'N/A', value: 'na' },
                        { label: 'Pending', value: 'pending' },
                        { label: 'Complied', value: 'complied' },
                        { label: 'Overdue', value: 'overdue' },
                    ]}
                    className="requirements-filter"
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
                onChange={(_, __, sorter) => {
                    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
                    if (!nextSorter?.order) {
                        setSortField('id');
                        setSortOrder('ascend');
                        return;
                    }
                    if (nextSorter.columnKey === 'requirement') {
                        setSortField('requirement');
                    } else if (nextSorter.columnKey === 'req_id') {
                        setSortField('req_id');
                    } else {
                        setSortField('id');
                    }
                    setSortOrder(nextSorter.order);
                }}
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
                                    options={agencyOptions}
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
                                    options={positionOptions}
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
                                    options={branchUnitOptions}
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
                        <Input type="date" min={todayDate} />
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
                    <>
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
                                {getPositionNames(detailData?.position_ids, positionsAll || positions) || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Branch/Unit/Department In Charge">
                                {getBranchUnitNames(detailData?.branch_unit_department_ids, branchUnitsAll || branchUnits) || 'N/A'}
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
                                {formatPhDate(detailData?.deadline)}
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
                        <div style={{ marginTop: 24 }}>
                            <Typography.Title level={5}>Uploads</Typography.Title>
                            {isAdmin ? (
                                <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    onClick={() => {
                                        if (detailData?.id) {
                                            setUploadRequirementId(detailData.id);
                                        } else {
                                            setUploadRequirementId(null);
                                        }
                                        setUploadFile(null);
                                        uploadForm.resetFields();
                                        if (detailData?.deadline) {
                                            uploadForm.setFieldsValue({ deadline_at_upload: dayjs(`${detailData.deadline}T00:00:00+08:00`) });
                                        }
                                        setUploadModalOpen(true);
                                    }}
                                    style={{ marginBottom: 12 }}
                                >
                                    Upload
                                </Button>
                            ) : null}
                            {detailData?.uploads && detailData.uploads.length > 0 ? (
                                (() => {
                                    const grouped = detailData.uploads.reduce<Record<string, UploadRecord[]>>((acc, upload) => {
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
                                                <Collapse
                                                    items={items.map((upload) => ({
                                                        key: String(upload.id),
                                                        label: `${upload.upload_id} - ${upload.uploader?.employee_name || upload.uploader_email || 'Unknown'}`,
                                                        children: (
                                                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                                                <div>Uploaded by: {upload.uploader?.employee_name || upload.uploader_email}</div>
                                                                <div>Uploaded at: {upload.upload_date ? new Date(upload.upload_date).toLocaleString() : 'N/A'}</div>
                                                                {upload.deadline_at_upload ? (
                                                                    <div>Deadline (upload): {formatPhDate(upload.deadline_at_upload)}</div>
                                                                ) : null}
                                                                {upload.approval_status !== 'PENDING' ? (
                                                                    <div>
                                                                        {upload.approval_status === 'APPROVED' ? 'Approved' : 'Rejected'} at:{' '}
                                                                        {upload.status_change_on ? new Date(upload.status_change_on).toLocaleString() : 'N/A'}
                                                                    </div>
                                                                ) : null}
                                                                <Space>
                                                                    <Tag color={upload.approval_status === 'APPROVED' ? 'success' : upload.approval_status === 'REJECTED' ? 'error' : 'processing'}>
                                                                        {upload.approval_status}
                                                                    </Tag>
                                                                    <Button size="small" onClick={() => handleViewUpload(upload.id)}>
                                                                        View file
                                                                    </Button>
                                                                </Space>
                                                            </Space>
                                                        ),
                                                    }))}
                                                />
                                            ),
                                        };
                                        });
                                    return <Collapse items={items} />;
                                })()
                            ) : (
                                <div style={{ textAlign: 'center', marginTop: 8 }}>
                                    <Text type="secondary">No uploads yet.</Text>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Drawer>
            <Modal
                title="Upload Requirement File"
                open={uploadModalOpen}
                onCancel={() => setUploadModalOpen(false)}
                onOk={() => uploadForm.submit()}
                okText="Submit"
                okButtonProps={{ disabled: isUploading }}
                confirmLoading={isUploading}
                destroyOnClose
            >
                <Form
                    form={uploadForm}
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
                        if (values.deadline_at_upload) {
                            formData.append('deadline_at_upload', values.deadline_at_upload.format('YYYY-MM-DD'));
                        }
                        if (values.approval_status) {
                            formData.append('approval_status', values.approval_status);
                        }
                        if (values.admin_remarks) {
                            formData.append('admin_remarks', values.admin_remarks);
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
                </Form>
            </Modal>
        </div>
    );
};

export default RequirementsPage;
