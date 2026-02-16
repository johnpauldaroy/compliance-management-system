import { useMemo, useState } from 'react';
import { Button, Form, Input, Drawer, Select, Space, Switch, Table, Tag, Typography, message, Alert, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircleOutlined, EditOutlined, KeyOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { userService } from '../services/apiService';
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
    'Admin Specialist',
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

const UsersPage = () => {
    const [form] = Form.useForm<UserFormValues>();
    const [passwordForm] = Form.useForm<{ password: string; password_confirmation: string }>();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [passwordUser, setPasswordUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ['users'],
        queryFn: userService.getAll,
    });

    const users: User[] = data?.data || [];

    const previewIdByType = useMemo<Record<string, string>>(() => {
        const prefixMap: Record<string, string> = {
            'Super Admin': 'SA',
            'Admin Specialist': 'AS',
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

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        form.setFieldsValue({ is_active: true, user_id: 'Select user type' });
        setIsDrawerOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        form.setFieldsValue({
            user_id: user.user_id,
            employee_name: user.employee_name,
            email: user.email,
            branch: user.branch,
            user_type: user.user_type || '',
            is_active: user.is_active ?? true,
        });
        setIsDrawerOpen(true);
    };

    const handleResetPassword = (user: User) => {
        setPasswordUser(user);
        passwordForm.resetFields();
        setIsPasswordOpen(true);
    };

    const handleSubmit = (values: UserFormValues) => {
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
        updateUser.mutate({
            id: user.id,
            payload: {
                employee_name: user.employee_name,
                email: user.email,
                branch: user.branch,
                user_type: user.user_type || 'Admin Specialist',
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
                        />
                    </Tooltip>
                    <Tooltip title="Reset password">
                        <Button
                            icon={<KeyOutlined />}
                            className="users-action users-action--warning"
                            aria-label="Reset password"
                            onClick={() => handleResetPassword(record)}
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
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ]), [updateUser]);

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
                    <Button type="primary" onClick={handleAdd}>Add User</Button>
                </div>
            </div>

            <Table
                columns={columns}
                dataSource={filteredUsers}
                rowKey="id"
                loading={isLoading}
            />

            <Drawer
                title={editingUser ? 'Edit User' : 'Add User'}
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                destroyOnClose
                width={720}
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
                                options={userTypeOptions}
                                onChange={(value: string) => {
                                    if (!editingUser) {
                                    form.setFieldsValue({ user_id: previewIdByType[value] || 'Auto-generated' });
                                    }
                                    if (value === 'Super Admin' || value === 'Admin Specialist') {
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
                <div className="users-drawer-footer">
                    <Space>
                        <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
                        <Button
                            type="primary"
                            onClick={() => form.submit()}
                            loading={createUser.isPending || updateUser.isPending}
                        >
                            {editingUser ? 'Save Changes' : 'Create User'}
                        </Button>
                    </Space>
                </div>
            </Drawer>

            <Drawer
                title={`Reset Password${passwordUser ? `: ${passwordUser.employee_name}` : ''}`}
                open={isPasswordOpen}
                onClose={() => setIsPasswordOpen(false)}
                destroyOnClose
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
                <div className="users-drawer-footer">
                    <Space>
                        <Button onClick={() => setIsPasswordOpen(false)}>Cancel</Button>
                        <Button
                            type="primary"
                            onClick={() => passwordForm.submit()}
                            loading={resetPassword.isPending}
                        >
                            Reset Password
                        </Button>
                    </Space>
                </div>
            </Drawer>
        </div>
    );
};

export default UsersPage;
