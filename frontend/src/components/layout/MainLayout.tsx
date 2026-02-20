import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Avatar, Button, Dropdown, Modal } from 'antd';
import {
    DashboardOutlined,
    BankOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    SafetyCertificateOutlined,
    UserOutlined,
    HistoryOutlined,
    LogoutOutlined,
    MenuOutlined,
} from '@ant-design/icons';
import { authService } from '../../services/authService';
import { canAccessPath, getAccessLevel, getDefaultRoute, isMenuKeyAllowed, type AccessLevel } from '../../lib/access';
import './MainLayout.css';
import { useQuery } from '@tanstack/react-query';
import type { User } from '../../types';

const { Sider, Header, Content } = Layout;
type MeResponse = { user: User };

const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);
    const lastDirection = useRef<'up' | 'down' | null>(null);
    const scrollTicking = useRef(false);
    const siderWidth = 256;
    const collapsedWidth = 80;

    const handleLogout = () => {
        Modal.confirm({
            title: 'Log out?',
            content: 'You will be signed out of the Compliance Management System.',
            okText: 'Log out',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await authService.logout();
                } finally {
                    navigate('/login');
                }
            },
        });
    };

    const menuItems = [
        { key: '/', label: 'Dashboard', icon: <DashboardOutlined /> },
        { key: '/agencies', label: 'Reference Data', icon: <BankOutlined /> },
        { key: '/requirements', label: 'Requirements', icon: <FileTextOutlined /> },
        { key: '/my-requirements', label: 'My Requirements', icon: <CheckCircleOutlined /> },
        { key: '/uploads', label: 'Approvals', icon: <SafetyCertificateOutlined /> },
        { key: '/users', label: 'Users', icon: <UserOutlined /> },
        { key: '/audit-trail', label: 'Audit Trail', icon: <HistoryOutlined /> },
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        navigate(key);
    };

    const profileMenuItems = [{ key: 'profile-details', label: 'Profile details' }];

    const handleProfileMenuClick = ({ key }: { key: string }) => {
        if (key === 'profile-details') {
            navigate('/profile');
        }
    };

    const { data } = useQuery<MeResponse>({
        queryKey: ['me'],
        queryFn: authService.me,
        retry: false,
    });

    const employeeName = data?.user?.employee_name || 'User';
    const accessLevel: AccessLevel = getAccessLevel(data?.user?.roles || []);
    const avatarInitials = employeeName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part, index, arr) => (index === 0 || index === arr.length - 1 ? part[0] : ''))
        .join('')
        .toUpperCase() || 'U';

    useEffect(() => {
        if (!canAccessPath(accessLevel, location.pathname)) {
            navigate(getDefaultRoute(accessLevel), { replace: true });
        }
    }, [accessLevel, location.pathname, navigate]);

    useEffect(() => {
        const handleScroll = () => {
            if (scrollTicking.current) {
                return;
            }
            scrollTicking.current = true;
            window.requestAnimationFrame(() => {
                const currentY = window.scrollY;
                const delta = currentY - lastScrollY.current;
                const direction: 'up' | 'down' | null = delta > 0 ? 'down' : delta < 0 ? 'up' : null;

                if (direction) {
                    lastDirection.current = direction;
                }

                if (currentY < 24) {
                    setHeaderVisible(true);
                } else if (lastDirection.current === 'down' && delta > 2) {
                    setHeaderVisible(false);
                } else if (lastDirection.current === 'up' && Math.abs(delta) > 8) {
                    setHeaderVisible(true);
                }

                lastScrollY.current = currentY;
                scrollTicking.current = false;
            });
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (event.clientY < 40) {
                setHeaderVisible(true);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <Layout className={`main-layout ${collapsed ? 'main-layout--collapsed' : ''}`}>
            <Sider
                width={siderWidth}
                collapsedWidth={collapsedWidth}
                theme="light"
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                trigger={null}
                className="main-layout__sider"
            >
                <div className="main-layout__brand">
                    <img
                        src="/cms-logo-black.png"
                        alt="CMS logo"
                        className="main-layout__logo"
                    />
                    <div className="main-layout__brand-text">
                        {collapsed ? 'CMS' : 'Compliance Management System'}
                    </div>
                </div>
                <div className="main-layout__divider" />
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems.filter((item) => isMenuKeyAllowed(accessLevel, String(item.key)))}
                    onClick={handleMenuClick}
                />
                <div className="main-layout__logout">
                    <Button
                        type="text"
                        danger
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                    >
                        {!collapsed ? 'Logout' : null}
                    </Button>
                </div>
            </Sider>
            <Layout className="main-layout__app">
                <Header
                    className={`main-layout__header ${headerVisible ? '' : 'main-layout__header--hidden'}`}
                >
                    <Button
                        type="text"
                        icon={<MenuOutlined />}
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label="Toggle navigation"
                    />
                    <div className="main-layout__header-right">
                        <div className="main-layout__greeting">
                            <div className="main-layout__greeting-text">Hello, {employeeName}</div>
                        </div>
                        <Dropdown menu={{ items: profileMenuItems, onClick: handleProfileMenuClick }} trigger={['click']}>
                            <Avatar className="main-layout__avatar">{avatarInitials}</Avatar>
                        </Dropdown>
                    </div>
                </Header>
                <Content
                    className={`main-layout__content ${headerVisible ? '' : 'main-layout__content--compact'}`}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
