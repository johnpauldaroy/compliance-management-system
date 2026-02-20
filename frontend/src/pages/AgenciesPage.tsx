import { Table, Button, Space, Form, Input, message, Typography, Modal, Tabs, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, ReloadOutlined, PoweroffOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { agencyService, branchUnitDepartmentService, positionService } from '../services/apiService';
import type { Agency, BranchUnitDepartment, Position } from '../types';
import './AgenciesPage.css';

const ReferenceDataPage = () => {
    const [agencyForm] = Form.useForm<{ agency_id: string; name: string }>();
    const [unitForm] = Form.useForm<{ name: string }>();
    const [positionForm] = Form.useForm<{ name: string }>();
    const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
    const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
    const [editingUnit, setEditingUnit] = useState<BranchUnitDepartment | null>(null);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);
    const [agencySearch, setAgencySearch] = useState('');
    const [unitSearch, setUnitSearch] = useState('');
    const [positionSearch, setPositionSearch] = useState('');

    const { data: agencies, isLoading: isAgenciesLoading, refetch: refetchAgencies } = useQuery<Agency[]>({
        queryKey: ['agencies'],
        queryFn: () => agencyService.getAll(),
    });

    const { data: branchUnits, isLoading: isUnitsLoading, refetch: refetchUnits } = useQuery<BranchUnitDepartment[]>({
        queryKey: ['branch-unit-departments'],
        queryFn: () => branchUnitDepartmentService.getAll(),
    });

    const { data: positions, isLoading: isPositionsLoading, refetch: refetchPositions } = useQuery<Position[]>({
        queryKey: ['positions'],
        queryFn: () => positionService.getAll(),
    });

    const createAgency = useMutation({
        mutationFn: agencyService.create,
        onSuccess: () => {
            message.success('Agency added.');
            setIsAgencyModalOpen(false);
            refetchAgencies();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to add agency.');
        },
    });

    const updateAgency = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: { agency_id: string; name: string } }) =>
            agencyService.update(id, payload),
        onSuccess: () => {
            message.success('Agency updated.');
            setIsAgencyModalOpen(false);
            refetchAgencies();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update agency.');
        },
    });

    const toggleAgencyActive = useMutation({
        mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
            agencyService.update(id, { is_active }),
        onSuccess: () => {
            message.success('Agency status updated.');
            refetchAgencies();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update agency status.');
        },
    });

    const createUnit = useMutation({
        mutationFn: branchUnitDepartmentService.create,
        onSuccess: () => {
            message.success('Branch/unit/department added.');
            setIsUnitModalOpen(false);
            refetchUnits();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to add branch/unit/department.');
        },
    });

    const updateUnit = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: { name: string } }) =>
            branchUnitDepartmentService.update(id, payload),
        onSuccess: () => {
            message.success('Branch/unit/department updated.');
            setIsUnitModalOpen(false);
            refetchUnits();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update branch/unit/department.');
        },
    });

    const toggleUnitActive = useMutation({
        mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
            branchUnitDepartmentService.update(id, { is_active }),
        onSuccess: () => {
            message.success('Branch/unit/department status updated.');
            refetchUnits();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update branch/unit/department status.');
        },
    });

    const createPosition = useMutation({
        mutationFn: positionService.create,
        onSuccess: () => {
            message.success('Position added.');
            setIsPositionModalOpen(false);
            refetchPositions();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to add position.');
        },
    });

    const updatePosition = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: { name: string } }) =>
            positionService.update(id, payload),
        onSuccess: () => {
            message.success('Position updated.');
            setIsPositionModalOpen(false);
            refetchPositions();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update position.');
        },
    });

    const togglePositionActive = useMutation({
        mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
            positionService.update(id, { is_active }),
        onSuccess: () => {
            message.success('Position status updated.');
            refetchPositions();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update position status.');
        },
    });

    const handleAgencyAdd = () => {
        setEditingAgency(null);
        agencyForm.resetFields();
        setIsAgencyModalOpen(true);
    };

    const handleAgencyEdit = (agency: Agency) => {
        setEditingAgency(agency);
        agencyForm.setFieldsValue({
            agency_id: agency.agency_id,
            name: agency.name,
        });
        setIsAgencyModalOpen(true);
    };

    const handleAgencySubmit = (values: { agency_id: string; name: string }) => {
        if (editingAgency) {
            updateAgency.mutate({ id: editingAgency.id, payload: values });
            return;
        }
        createAgency.mutate(values);
    };

    const handleAgencyToggle = (agency: Agency) => {
        const nextActive = !agency.is_active;
        Modal.confirm({
            title: `${nextActive ? 'Activate' : 'Deactivate'} ${agency.name}?`,
            content: nextActive
                ? 'This agency will be available in requirement forms.'
                : 'This agency will be hidden from requirement forms.',
            okText: nextActive ? 'Activate' : 'Deactivate',
            okType: nextActive ? 'primary' : 'danger',
            onOk: () => toggleAgencyActive.mutate({ id: agency.id, is_active: nextActive }),
        });
    };

    const handleUnitAdd = () => {
        setEditingUnit(null);
        unitForm.resetFields();
        setIsUnitModalOpen(true);
    };

    const handleUnitEdit = (unit: BranchUnitDepartment) => {
        setEditingUnit(unit);
        unitForm.setFieldsValue({ name: unit.name });
        setIsUnitModalOpen(true);
    };

    const handleUnitSubmit = (values: { name: string }) => {
        if (editingUnit) {
            updateUnit.mutate({ id: editingUnit.id, payload: values });
            return;
        }
        createUnit.mutate(values);
    };

    const handleUnitToggle = (unit: BranchUnitDepartment) => {
        const nextActive = !unit.is_active;
        Modal.confirm({
            title: `${nextActive ? 'Activate' : 'Deactivate'} ${unit.name}?`,
            content: nextActive
                ? 'This item will be available in requirement forms.'
                : 'This item will be hidden from requirement forms.',
            okText: nextActive ? 'Activate' : 'Deactivate',
            okType: nextActive ? 'primary' : 'danger',
            onOk: () => toggleUnitActive.mutate({ id: unit.id, is_active: nextActive }),
        });
    };

    const handlePositionAdd = () => {
        setEditingPosition(null);
        positionForm.resetFields();
        setIsPositionModalOpen(true);
    };

    const handlePositionEdit = (position: Position) => {
        setEditingPosition(position);
        positionForm.setFieldsValue({ name: position.name });
        setIsPositionModalOpen(true);
    };

    const handlePositionSubmit = (values: { name: string }) => {
        if (editingPosition) {
            updatePosition.mutate({ id: editingPosition.id, payload: values });
            return;
        }
        createPosition.mutate(values);
    };

    const handlePositionToggle = (position: Position) => {
        const nextActive = !position.is_active;
        Modal.confirm({
            title: `${nextActive ? 'Activate' : 'Deactivate'} ${position.name}?`,
            content: nextActive
                ? 'This position will be available in requirement forms.'
                : 'This position will be hidden from requirement forms.',
            okText: nextActive ? 'Activate' : 'Deactivate',
            okType: nextActive ? 'primary' : 'danger',
            onOk: () => togglePositionActive.mutate({ id: position.id, is_active: nextActive }),
        });
    };

    const agencyColumns: ColumnsType<Agency> = [
        { title: 'Agency ID', dataIndex: 'agency_id', key: 'agency_id' },
        { title: 'Name', dataIndex: 'name', key: 'name' },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <Tag color={record.is_active === false ? 'default' : 'green'}>
                    {record.is_active === false ? 'Inactive' : 'Active'}
                </Tag>
            ),
        },
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleAgencyEdit(record)}>
                        Edit
                    </Button>
                    <Tooltip title={record.is_active === false ? 'Activate' : 'Deactivate'}>
                        <Button
                            type="link"
                            icon={record.is_active === false ? <CheckCircleOutlined /> : <PoweroffOutlined />}
                            danger={record.is_active !== false}
                            onClick={() => handleAgencyToggle(record)}
                        >
                            {record.is_active === false ? 'Activate' : 'Deactivate'}
                        </Button>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const filteredAgencies = useMemo(() => {
        const term = agencySearch.trim().toLowerCase();
        if (!term) {
            return agencies || [];
        }
        return (agencies || []).filter((agency) =>
            `${agency.agency_id} ${agency.name}`.toLowerCase().includes(term)
        );
    }, [agencies, agencySearch]);

    const filteredUnits = useMemo(() => {
        const term = unitSearch.trim().toLowerCase();
        if (!term) {
            return branchUnits || [];
        }
        return (branchUnits || []).filter((unit) =>
            unit.name.toLowerCase().includes(term)
        );
    }, [branchUnits, unitSearch]);

    const filteredPositions = useMemo(() => {
        const term = positionSearch.trim().toLowerCase();
        if (!term) {
            return positions || [];
        }
        return (positions || []).filter((position) =>
            position.name.toLowerCase().includes(term)
        );
    }, [positions, positionSearch]);

    const unitColumns: ColumnsType<BranchUnitDepartment> = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <Tag color={record.is_active === false ? 'default' : 'green'}>
                    {record.is_active === false ? 'Inactive' : 'Active'}
                </Tag>
            ),
        },
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => handleUnitEdit(record)}>
                        Edit
                    </Button>
                    <Tooltip title={record.is_active === false ? 'Activate' : 'Deactivate'}>
                        <Button
                            type="link"
                            icon={record.is_active === false ? <CheckCircleOutlined /> : <PoweroffOutlined />}
                            danger={record.is_active !== false}
                            onClick={() => handleUnitToggle(record)}
                        >
                            {record.is_active === false ? 'Activate' : 'Deactivate'}
                        </Button>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const positionColumns: ColumnsType<Position> = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        {
            title: 'Status',
            key: 'status',
            render: (_, record) => (
                <Tag color={record.is_active === false ? 'default' : 'green'}>
                    {record.is_active === false ? 'Inactive' : 'Active'}
                </Tag>
            ),
        },
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button type="link" icon={<EditOutlined />} onClick={() => handlePositionEdit(record)}>
                        Edit
                    </Button>
                    <Tooltip title={record.is_active === false ? 'Activate' : 'Deactivate'}>
                        <Button
                            type="link"
                            icon={record.is_active === false ? <CheckCircleOutlined /> : <PoweroffOutlined />}
                            danger={record.is_active !== false}
                            onClick={() => handlePositionToggle(record)}
                        >
                            {record.is_active === false ? 'Activate' : 'Deactivate'}
                        </Button>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div className="reference-page">
            <div className="reference-header">
                <Typography.Title level={2} className="reference-title">Reference Data Management</Typography.Title>
            </div>
            <Tabs
                items={[
                    {
                        key: 'agencies',
                        label: 'Agencies',
                        children: (
                            <div className="reference-section">
                                <div className="reference-section-header">
                                    <Typography.Title level={4} className="reference-section-title">Agencies</Typography.Title>
                                    <div className="reference-actions-row">
                                        <div className="reference-search-group">
                                            <Input
                                                placeholder="Search agencies"
                                                value={agencySearch}
                                                onChange={(event) => setAgencySearch(event.target.value)}
                                                allowClear
                                                className="reference-search"
                                            />
                                            <Button
                                                icon={<ReloadOutlined />}
                                                loading={isAgenciesLoading}
                                                onClick={() => refetchAgencies()}
                                            />
                                        </div>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAgencyAdd}>Add Agency</Button>
                                    </div>
                                </div>
                                <Table
                                    columns={agencyColumns}
                                    dataSource={filteredAgencies}
                                    rowKey="id"
                                    loading={isAgenciesLoading}
                                    pagination={{ pageSize: 10 }}
                                />
                            </div>
                        ),
                    },
                    {
                        key: 'branch-units',
                        label: 'Branch/Unit/Department',
                        children: (
                            <div className="reference-section">
                                <div className="reference-section-header">
                                    <Typography.Title level={4} className="reference-section-title">Branch/Unit/Department In Charge</Typography.Title>
                                    <div className="reference-actions-row">
                                        <div className="reference-search-group">
                                            <Input
                                                placeholder="Search branch/unit/department"
                                                value={unitSearch}
                                                onChange={(event) => setUnitSearch(event.target.value)}
                                                allowClear
                                                className="reference-search"
                                            />
                                            <Button
                                                icon={<ReloadOutlined />}
                                                loading={isUnitsLoading}
                                                onClick={() => refetchUnits()}
                                            />
                                        </div>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={handleUnitAdd}>
                                            Add Branch/Unit/Department
                                        </Button>
                                    </div>
                                </div>
                                <Table
                                    columns={unitColumns}
                                    dataSource={filteredUnits}
                                    rowKey="id"
                                    loading={isUnitsLoading}
                                    pagination={{ pageSize: 10 }}
                                />
                            </div>
                        ),
                    },
                    {
                        key: 'positions',
                        label: 'Position Assigned To',
                        children: (
                            <div className="reference-section">
                                <div className="reference-section-header">
                                    <Typography.Title level={4} className="reference-section-title">Position Assigned To</Typography.Title>
                                    <div className="reference-actions-row">
                                        <div className="reference-search-group">
                                            <Input
                                                placeholder="Search positions"
                                                value={positionSearch}
                                                onChange={(event) => setPositionSearch(event.target.value)}
                                                allowClear
                                                className="reference-search"
                                            />
                                            <Button
                                                icon={<ReloadOutlined />}
                                                loading={isPositionsLoading}
                                                onClick={() => refetchPositions()}
                                            />
                                        </div>
                                        <Button type="primary" icon={<PlusOutlined />} onClick={handlePositionAdd}>
                                            Add Position
                                        </Button>
                                    </div>
                                </div>
                                <Table
                                    columns={positionColumns}
                                    dataSource={filteredPositions}
                                    rowKey="id"
                                    loading={isPositionsLoading}
                                    pagination={{ pageSize: 10 }}
                                />
                            </div>
                        ),
                    },
                ]}
            />

            <Modal
                title={editingAgency ? 'Edit Agency' : 'Add Agency'}
                open={isAgencyModalOpen}
                onCancel={() => setIsAgencyModalOpen(false)}
                onOk={() => agencyForm.submit()}
                okText={editingAgency ? 'Save Changes' : 'Create Agency'}
                confirmLoading={createAgency.isPending || updateAgency.isPending}
                destroyOnClose
                width={520}
            >
                <Form form={agencyForm} layout="vertical" onFinish={handleAgencySubmit}>
                    <Form.Item
                        label="Agency ID"
                        name="agency_id"
                        rules={[{ required: true, message: 'Agency ID is required.' }]}
                    >
                        <Input
                            disabled={Boolean(editingAgency)}
                            onChange={(event) => {
                                const value = event.target.value.toUpperCase();
                                agencyForm.setFieldsValue({ agency_id: value });
                            }}
                        />
                    </Form.Item>
                    <Form.Item
                        label="Agency Name"
                        name="name"
                        rules={[{ required: true, message: 'Agency name is required.' }]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingUnit ? 'Edit Branch/Unit/Department' : 'Add Branch/Unit/Department'}
                open={isUnitModalOpen}
                onCancel={() => setIsUnitModalOpen(false)}
                onOk={() => unitForm.submit()}
                okText={editingUnit ? 'Save Changes' : 'Create'}
                confirmLoading={createUnit.isPending || updateUnit.isPending}
                destroyOnClose
                width={520}
            >
                <Form form={unitForm} layout="vertical" onFinish={handleUnitSubmit}>
                    <Form.Item
                        label="Name"
                        name="name"
                        rules={[{ required: true, message: 'Name is required.' }]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingPosition ? 'Edit Position' : 'Add Position'}
                open={isPositionModalOpen}
                onCancel={() => setIsPositionModalOpen(false)}
                onOk={() => positionForm.submit()}
                okText={editingPosition ? 'Save Changes' : 'Create'}
                confirmLoading={createPosition.isPending || updatePosition.isPending}
                destroyOnClose
                width={520}
            >
                <Form form={positionForm} layout="vertical" onFinish={handlePositionSubmit}>
                    <Form.Item
                        label="Name"
                        name="name"
                        rules={[{ required: true, message: 'Name is required.' }]}
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ReferenceDataPage;
