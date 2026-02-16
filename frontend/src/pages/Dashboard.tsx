import { Card, Row, Col, Statistic, Progress, List as AntList, Typography as AntTypography } from 'antd';
import {
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    UserOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/apiService';
import './Dashboard.css';

const { Text } = AntTypography;

const Dashboard = () => {
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: dashboardService.getStats,
    });

    const { data: activity, isLoading: activityLoading } = useQuery({
        queryKey: ['dashboard-activity'],
        queryFn: dashboardService.getActivity,
    });

    const statCards = [
        { title: 'Total Requirements', value: stats?.total_requirements || 0, icon: <FileTextOutlined />, colorClass: 'dashboard-stat--blue' },
        { title: 'Compliant', value: stats?.compliant || 0, icon: <CheckCircleOutlined />, colorClass: 'dashboard-stat--green' },
        { title: 'Pending', value: stats?.pending || 0, icon: <ClockCircleOutlined />, colorClass: 'dashboard-stat--gold' },
        { title: 'Overdue', value: stats?.overdue || 0, icon: <WarningOutlined />, colorClass: 'dashboard-stat--red' },
    ];

    return (
        <div className="dashboard-page">
            <h2 className="dashboard-title">Dashboard</h2>

            <Row gutter={[16, 16]}>
                {statCards.map((stat, index) => (
                    <Col xs={24} sm={12} lg={6} key={index}>
                        <Card className={`dashboard-stat ${stat.colorClass}`} loading={statsLoading}>
                            <Statistic
                                title={stat.title}
                                value={stat.value}
                                prefix={<span className="dashboard-stat-icon">{stat.icon}</span>}
                            />
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row gutter={[16, 16]} className="dashboard-row">
                <Col xs={24} lg={12}>
                    <Card title="Compliance Rate" loading={statsLoading}>
                        <div className="dashboard-center">
                            <Progress
                                type="circle"
                                percent={stats?.compliance_rate || 0}
                                format={percent => `${percent}%`}
                                strokeColor="#52c41a"
                                width={200}
                            />
                            <p className="dashboard-muted">Overall compliance rate</p>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="Recent Activity" loading={activityLoading}>
                        {activity && activity.length > 0 ? (
                            <AntList
                                itemLayout="horizontal"
                                dataSource={activity}
                                renderItem={(log: any) => (
                                    <AntList.Item>
                                        <AntList.Item.Meta
                                            avatar={<UserOutlined />}
                                            title={<Text strong>{log.actor?.employee_name || 'System'}</Text>}
                                            description={
                                                <span>
                                                    {log.action} - <Text type="secondary">{new Date(log.created_at).toLocaleString()}</Text>
                                                </span>
                                            }
                                        />
                                    </AntList.Item>
                                )}
                            />
                        ) : (
                            <div className="dashboard-empty">
                                No recent activity
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;
