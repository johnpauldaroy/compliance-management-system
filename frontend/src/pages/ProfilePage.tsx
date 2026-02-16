import { Card, Form, Input, Button, Typography, message, Divider, Select, Tooltip } from 'antd';
import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { profileService } from '../services/apiService';
import './ProfilePage.css';

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

const ProfilePage = () => {
    const [profileForm] = Form.useForm();
    const [passwordForm] = Form.useForm();

    const { data, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: profileService.get,
    });

    const normalizeUserType = (user: any) => {
        const roleName = user?.roles?.[0]?.name;
        const rawType = user?.user_type;
        const mappedFromRole = roleName === 'Super Admin'
            ? 'Super Admin'
            : roleName === 'Compliance & Admin Specialist'
                ? 'Admin Specialist'
                : roleName === 'Person-In-Charge (PIC)'
                    ? 'Person-in-Charge'
                    : '';

        if (rawType === 'Person-In-Charge') {
            return 'Person-in-Charge';
        }
        if (rawType === 'Compliance & Admin Specialist') {
            return 'Admin Specialist';
        }

        return rawType || mappedFromRole || '';
    };

    const updateProfile = useMutation({
        mutationFn: profileService.update,
        onSuccess: (response) => {
            message.success('Profile updated.');
            profileForm.setFieldsValue({
                ...response.user,
                user_type: normalizeUserType(response.user),
            });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update profile.');
        },
    });

    const updatePassword = useMutation({
        mutationFn: profileService.updatePassword,
        onSuccess: () => {
            message.success('Password updated.');
            passwordForm.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update password.');
        },
    });

    useEffect(() => {
        if (data?.user) {
            profileForm.setFieldsValue({
                ...data.user,
                user_type: normalizeUserType(data.user),
            });
        }
    }, [data, profileForm]);

    return (
        <div className="profile-page">
            <Title level={2}>Profile Details</Title>
            <Text type="secondary">Update your information and manage your password.</Text>

            <Card className="profile-card" loading={isLoading}>
                <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={(values) => updateProfile.mutate(values)}
                >
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
                            { type: 'email', message: 'Enter a valid email address.' },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item label="User Type" required>
                        <Tooltip
                            title="Please contact your Super Admin if there are changes in your roles."
                            open={data?.user?.roles?.some((role) => role?.name === 'Compliance & Admin Specialist' || role?.name === 'Person-In-Charge (PIC)') ? undefined : false}
                        >
                            <span className="profile-inline">
                            <Form.Item
                                name="user_type"
                                rules={[{ required: true, message: 'User type is required.' }]}
                                noStyle
                            >
                                <Select
                                    placeholder="Select a user type"
                                    options={userTypeOptions}
                                    disabled={data?.user?.roles?.some((role) => role?.name === 'Compliance & Admin Specialist' || role?.name === 'Person-In-Charge (PIC)')}
                                />
                            </Form.Item>
                            </span>
                        </Tooltip>
                    </Form.Item>
                    <Form.Item
                        label="Branch"
                        name="branch"
                        rules={[{ required: true, message: 'Branch is required.' }]}
                    >
                        <Select
                            placeholder="Select a branch"
                            options={branchOptions}
                            showSearch
                            optionFilterProp="label"
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={updateProfile.isPending}>
                            Save Changes
                        </Button>
                    </Form.Item>
                </Form>

                <Divider />

                <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={(values) => updatePassword.mutate(values)}
                >
                    <Form.Item
                        label="Current Password"
                        name="current_password"
                        rules={[{ required: true, message: 'Current password is required.' }]}
                    >
                        <Input.Password />
                    </Form.Item>
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
                        label="Confirm New Password"
                        name="password_confirmation"
                        dependencies={['password']}
                        rules={[
                            { required: true, message: 'Please confirm your new password.' },
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
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={updatePassword.isPending}>
                            Update Password
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default ProfilePage;
