import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography, message, Alert, Tooltip, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircleOutlined, EditOutlined, KeyOutlined, ReloadOutlined, StopOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { userService } from '../services/apiService';
import { authService } from '../services/authService';
import type { User } from '../types';
import './UsersPage.css';

const { Title, Text } = Typography;

const branchOptions = [
    'Head Office',
    'Barbaza',
    'Culasi',
    'Sibalom',
    'San Jose',
    'Balasan',
    'Barotac Viejo',
    'Caticlan',
    'Molo',
    'Kalibo',
    'Janiuay',
    'Calinog',
    'Sara',
    'President Roxas',
    'Buenavista',
].map((branch) => ({ label: branch, value: branch }));

const userTypeOptions = [
    'Super Admin',
    'Compliance & Admin Specialist',
    'Person-in-Charge',
].map((userType) => ({ label: userType, value: userType }));

type UserFormValues = {
    user_id?: string;
    employee_name: string;
    email: string;
    branch: string;
    user_type: string;
    password?: string;
    is_active: boolean;
};

const normalizeUserTypeValue = (value?: string | null) => value || '';

const UsersPage = () => {
    const [form] = Form.useForm<UserFormValues>();
    const [passwordForm] = Form.useForm<{ password: string; password_confirmation: string }>();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [passwordUser, setPasswordUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isSpecialist, setIsSpecialist] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isTemplateOpen, setIsTemplateOpen] = useState(false);

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ['users'],
        queryFn: userService.getAll,
    });

    const users: User[] = data?.data || [];

    useEffect(() => {
        let isActive = true;
        authService
            .me()
            .then((data) => {
                if (!isActive) {
                    return;
                }
                const roles = data?.user?.roles || [];
                setIsSuperAdmin(roles.some((role: any) => role.name === 'Super Admin'));
                setIsSpecialist(
                    roles.some((role: any) =>
                        role.name === 'Compliance & Admin Specialist'
                    )
                );
                setCurrentUserId(data?.user?.id ?? null);
            })
            .catch(() => {});

        return () => {
            isActive = false;
        };
    }, []);

    const canManageUsers = isSuperAdmin || isSpecialist;
    const canManageUserType = (userType?: string | null) => {
        if (isSuperAdmin) {
            return true;
        }
        if (!isSpecialist) {
            return false;
        }
        const normalized = normalizeUserTypeValue(userType);
        return normalized === 'Compliance & Admin Specialist' || normalized === 'Person-in-Charge';
    };
    const isSuperAdminUser = (user: User) =>
        user.user_type === 'Super Admin' || user.roles?.some((role) => role.name === 'Super Admin');
    const isPicUser = (user: User) =>
        user.user_type === 'Person-in-Charge' || user.roles?.some((role) => role.name === 'Person-In-Charge (PIC)');
    const canManageTarget = (user: User) => {
        if (isSuperAdmin) {
            return true;
        }
        return canManageUserType(user.user_type) && !isSuperAdminUser(user);
    };
    const canToggleActiveFor = (user: User) => {
        if (isSuperAdmin) {
            return true;
        }
        if (!isSpecialist) {
            return false;
        }
        if (isSuperAdminUser(user)) {
            return false;
        }
        if (currentUserId && user.id === currentUserId) {
            return false;
        }
        return canManageUserType(user.user_type);
    };
    const canResetPasswordFor = (user: User) => isSuperAdmin || (isSpecialist && isPicUser(user));

    const previewIdByType = useMemo<Record<string, string>>(() => {
        const prefixMap: Record<string, string> = {
            'Super Admin': 'SA',
            'Compliance & Admin Specialist': 'AS',
            'Person-in-Charge': 'PIC',
        };
        const result: Record<string, string> = {};
        Object.entries(prefixMap).forEach(([type, prefix]) => {
            const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
            result[type] = `${prefix}${random}`;
        });
        return result;
    }, []);

    const roleFilterOptions = useMemo(() => {
        const roles = Array.from(
            new Set(users.map((user) => user.roles?.[0]?.name).filter(Boolean))
        ) as string[];
        return ['all', ...roles.sort()];
    }, [users]);

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return users.filter((user) => {
            if (roleFilter !== 'all' && user.roles?.[0]?.name !== roleFilter) {
                return false;
            }
            if (!term) {
                return true;
            }
            return (
                user.user_id.toLowerCase().includes(term) ||
                user.employee_name.toLowerCase().includes(term) ||
                user.email.toLowerCase().includes(term) ||
                user.branch.toLowerCase().includes(term) ||
                (user.user_type || '').toLowerCase().includes(term)
            );
        });
    }, [users, roleFilter, searchTerm]);

    const createUser = useMutation({
        mutationFn: userService.create,
        onSuccess: () => {
            message.success('User added.');
            setIsDrawerOpen(false);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to add user.');
        },
    });

    const updateUser = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: UserFormValues }) =>
            userService.update(id, {
                employee_name: payload.employee_name,
                email: payload.email,
                branch: payload.branch,
                user_type: payload.user_type,
                is_active: payload.is_active,
            }),
        onSuccess: () => {
            message.success('User updated.');
            setIsDrawerOpen(false);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update user.');
        },
    });

    const resetPassword = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: { password: string; password_confirmation: string } }) =>
            userService.resetPassword(id, payload),
        onSuccess: () => {
            message.success('Password reset.');
            setIsPasswordOpen(false);
            passwordForm.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to reset password.');
        },
    });

    const importUsers = useMutation({
        mutationFn: userService.import,
        onSuccess: (response) => {
            const created = response?.created ?? 0;
            const errors = response?.errors ?? [];
            if (errors.length) {
                message.warning(`Imported ${created} rows, ${errors.length} failed.`);
            } else {
                message.success(`Imported ${created} rows.`);
            }
            setIsImportOpen(false);
            setImportFile(null);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to import users.');
        },
    });

    const handleAdd = () => {
        if (!canManageUsers) {
            message.error('You do not have permission to add users.');
            return;
        }
        setEditingUser(null);
        form.resetFields();
        form.setFieldsValue({ is_active: true, user_id: 'Select user type' });
        setIsDrawerOpen(true);
    };

    const handleDownloadTemplate = () => {
        const headers = ['employee_name', 'email_address', 'user_type', 'branch', 'password'];
        const csv = `${headers.join(',')}\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'user_import_template.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleEdit = (user: User) => {
        if (!canManageTarget(user)) {
            message.error('You do not have permission to edit this user.');
            return;
        }
        setEditingUser(user);
        form.setFieldsValue({
            user_id: user.user_id,
            employee_name: user.employee_name,
            email: user.email,
            branch: user.branch,
            user_type: normalizeUserTypeValue(user.user_type),
            is_active: user.is_active ?? true,
        });
        setIsDrawerOpen(true);
    };

    const handleResetPassword = (user: User) => {
        if (!canResetPasswordFor(user)) {
            message.error('You do not have permission to reset passwords.');
            return;
        }
        setPasswordUser(user);
        passwordForm.resetFields();
        setIsPasswordOpen(true);
    };

    const handleSubmit = (values: UserFormValues) => {
        if (!canManageUsers || !canManageUserType(values.user_type)) {
            message.error('You do not have permission to manage this user type.');
            return;
        }
        if (editingUser) {
            updateUser.mutate({ id: editingUser.id, payload: values });
            return;
        }
        createUser.mutate({
            employee_name: values.employee_name,
            email: values.email,
            branch: values.branch,
            user_type: values.user_type,
            password: values.password || '',
            is_active: values.is_active ?? true,
        });
    };

    const handleToggleActive = (user: User, isActive: boolean) => {
        if (!canToggleActiveFor(user)) {
            message.error('You do not have permission to update this user.');
            return;
        }
        updateUser.mutate({
            id: user.id,
            payload: {
                employee_name: user.employee_name,
                email: user.email,
                branch: user.branch,
                user_type: normalizeUserTypeValue(user.user_type) || 'Compliance & Admin Specialist',
                is_active: isActive,
            },
        });
    };

    const columns: ColumnsType<User> = useMemo(() => ([
        {
            title: 'User ID',
            dataIndex: 'user_id',
            key: 'user_id',
        },
        {
            title: 'Name',
            dataIndex: 'employee_name',
            key: 'employee_name',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Branch',
            dataIndex: 'branch',
            key: 'branch',
        },
        {
            title: 'Role',
            key: 'role',
            render: (_, record) => (
                <Tag color="blue">{record.roles?.[0]?.name || 'N/A'}</Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            icon={<EditOutlined />}
                            className="users-action users-action--info"
                            aria-label="Edit user"
                            onClick={() => handleEdit(record)}
                            disabled={!canManageTarget(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Reset password">
                        <Button
                            icon={<KeyOutlined />}
                            className="users-action users-action--warning"
                            aria-label="Reset password"
                            onClick={() => handleResetPassword(record)}
                            disabled={!canResetPasswordFor(record)}
                        />
                    </Tooltip>
                    <Tooltip title={record.is_active ?? true ? 'Deactivate' : 'Activate'}>
                        <Button
                            icon={
                                record.is_active ?? true
                                    ? <CheckCircleOutlined className="users-action--success" />
                                    : <StopOutlined className="users-action--danger" />
                            }
                            aria-label={record.is_active ?? true ? 'Deactivate user' : 'Activate user'}
                            onClick={() => handleToggleActive(record, !(record.is_active ?? true))}
                            disabled={!canToggleActiveFor(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ]), [canManageTarget, canToggleActiveFor, handleEdit, handleResetPassword, handleToggleActive, isSuperAdmin, updateUser]);

    return (
        <div className="users-page">
            {error && (
                <Alert
                    type="error"
                    message="Unable to load users"
                    description={(error as any)?.response?.data?.message || 'Please check your permissions or try again.'}
                    className="users-alert"
                />
            )}
            <Space className="users-header" wrap>
                <div className="users-title">
                    <Title level={2} className="users-title-text">User Management</Title>
                    <Text type="secondary">Manage user accounts and access.</Text>
                </div>
            </Space>
            <div className="users-toolbar">
                <Space wrap>
                    <Input
                        placeholder="Search users"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        allowClear
                        className="users-search"
                    />
                    <Select
                        value={roleFilter}
                        onChange={setRoleFilter}
                        className="users-filter"
                        options={roleFilterOptions.map((role) => ({
                            value: role,
                            label: role === 'all' ? 'All roles' : role,
                        }))}
                    />
                    <Tooltip title="Refresh">
                        <Button
                            icon={<ReloadOutlined />}
                            loading={isFetching}
                            onClick={async () => {
                                const key = 'users-refresh';
                                message.loading({ content: 'Data is refreshing...', key });
                                await refetch();
                                message.success({ content: 'Data is up to date.', key, duration: 2 });
                            }}
                        />
                    </Tooltip>
                </Space>
                <div className="users-toolbar-right">
                    <Space>
                        <Button icon={<DownloadOutlined />} onClick={() => setIsTemplateOpen(true)}>
                            Template
                        </Button>
                        <Button icon={<UploadOutlined />} onClick={() => setIsImportOpen(true)} disabled={!canManageUsers}>
                            Import
                        </Button>
                        <Button type="primary" onClick={handleAdd} disabled={!canManageUsers}>Add User</Button>
                    </Space>
                </div>
            </div>

            <Table
                columns={columns}
                dataSource={filteredUsers}
                rowKey="id"
                loading={isLoading}
            />

            <Modal
                title={editingUser ? 'Edit User' : 'Add User'}
                open={isDrawerOpen}
                onCancel={() => setIsDrawerOpen(false)}
                destroyOnHidden
                onOk={() => form.submit()}
                okText={editingUser ? 'Save Changes' : 'Create User'}
                confirmLoading={createUser.isPending || updateUser.isPending}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item label="User ID" name="user_id">
                        <Input disabled />
                    </Form.Item>
                    <Form.Item
                        label="Employee Name"
                        name="employee_name"
                        rules={[{ required: true, message: 'Employee name is required.' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Email Address"
                        name="email"
                        rules={[
                            { required: true, message: 'Email is required.' },
                            { type: 'email', message: 'Enter a valid email.' },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <div className="users-field-row">
                        <Form.Item
                            label="User Type"
                            name="user_type"
                            rules={[{ required: true, message: 'User type is required.' }]}
                            className="users-field"
                        >
                            <Select
                                options={userTypeOptions.filter((option) => canManageUserType(option.value))}
                                onChange={(value: string) => {
                                    if (!editingUser) {
                                    form.setFieldsValue({ user_id: previewIdByType[value] || 'Auto-generated' });
                                    }
                                    if (value === 'Super Admin' || value === 'Compliance & Admin Specialist') {
                                        form.setFieldsValue({ branch: 'Head Office' });
                                    }
                                }}
                            />
                        </Form.Item>
                        <Form.Item
                            label="Branch"
                            name="branch"
                            rules={[{ required: true, message: 'Branch is required.' }]}
                            className="users-field"
                        >
                            <Select
                                options={branchOptions}
                                showSearch
                                optionFilterProp="label"
                            />
                        </Form.Item>
                    </div>
                    {!editingUser && (
                        <Form.Item
                            label="Password"
                            name="password"
                            rules={[
                                { required: true, message: 'Password is required.' },
                                { min: 8, message: 'Password must be at least 8 characters.' },
                            ]}
                        >
                            <Input.Password />
                        </Form.Item>
                    )}
                    {editingUser && (
                        <Form.Item label="Active" name="is_active" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            <Modal
                title={`Reset Password${passwordUser ? `: ${passwordUser.employee_name}` : ''}`}
                open={isPasswordOpen}
                onCancel={() => setIsPasswordOpen(false)}
                destroyOnHidden
                onOk={() => passwordForm.submit()}
                okText="Reset Password"
                confirmLoading={resetPassword.isPending}
            >
                <Form form={passwordForm} layout="vertical" onFinish={(values) => {
                    if (!passwordUser) {
                        return;
                    }
                    resetPassword.mutate({ id: passwordUser.id, payload: values });
                }}>
                    <Form.Item
                        label="New Password"
                        name="password"
                        rules={[
                            { required: true, message: 'New password is required.' },
                            { min: 8, message: 'Password must be at least 8 characters.' },
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>
                    <Form.Item
                        label="Confirm Password"
                        name="password_confirmation"
                        dependencies={['password']}
                        rules={[
                            { required: true, message: 'Please confirm the password.' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Passwords do not match.'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Import Users"
                open={isImportOpen}
                onCancel={() => {
                    setIsImportOpen(false);
                    setImportFile(null);
                }}
                onOk={() => {
                    if (!importFile) {
                        message.error('Please select a file to import.');
                        return;
                    }
                    importUsers.mutate(importFile);
                }}
                okText="Import"
                confirmLoading={importUsers.isPending}
                destroyOnHidden
            >
                <Space direction="vertical" className="users-import">
                    <Typography.Text type="secondary">
                        Upload a CSV file using the provided template. New users will be active by default.
                    </Typography.Text>
                    <Upload
                        accept=".csv"
                        showUploadList={false}
                        beforeUpload={(file) => {
                            setImportFile(file);
                            return false;
                        }}
                    >
                        <Button icon={<UploadOutlined />}>Select File</Button>
                    </Upload>
                    {importFile && (
                        <Typography.Text>
                            Selected: {importFile.name}
                        </Typography.Text>
                    )}
                </Space>
            </Modal>

            <Modal
                title="Download Template"
                open={isTemplateOpen}
                onCancel={() => setIsTemplateOpen(false)}
                onOk={() => {
                    handleDownloadTemplate();
                    setIsTemplateOpen(false);
                }}
                okText="Download"
                destroyOnHidden
            >
                <Space direction="vertical" className="users-import">
                    <Typography.Text type="secondary">
                        Download the CSV template for importing users.
                    </Typography.Text>
                </Space>
            </Modal>
        </div>
    );
};

export default UsersPage;
