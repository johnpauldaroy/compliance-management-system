import { Typography, Button, Row, Col, Card, Progress, Statistic, Space, message, Select } from 'antd';
import {
    PieChartOutlined,
    BarChartOutlined,
    FileProtectOutlined,
    WarningOutlined,
    DownloadOutlined
} from '@ant-design/icons';
import './ReportsPage.css';
import { dashboardService, requirementService } from '../services/apiService';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

const ReportsPage = () => {
    const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: dashboardService.getStats,
    });

    const { data: agencyStats, isLoading: agencyLoading } = useQuery({
        queryKey: ['agency-stats'],
        queryFn: dashboardService.getAgencyStats,
    });

    const downloadBlob = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleExport = async () => {
        try {
            const blob = await requirementService.exportCsv();
            const dateSuffix = new Date().toISOString().slice(0, 10);

            if (exportFormat === 'csv') {
                downloadBlob(blob, `requirements_export_${dateSuffix}.csv`);
                return;
            }

            const csvText = await blob.text();
            const worksheet = XLSX.utils.csv_to_sheet(csvText);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Requirements');
            XLSX.writeFile(workbook, `requirements_export_${dateSuffix}.xlsx`);
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to export requirements.');
        }
    };

    return (
        <div className="reports-page">
            <div className="reports-header">
                <Title level={2} className="reports-title">Compliance Reports</Title>
                <Space>
                    <Select
                        value={exportFormat}
                        onChange={(value) => setExportFormat(value)}
                        options={[
                            { value: 'csv', label: 'CSV' },
                            { value: 'xlsx', label: 'XLSX' },
                        ]}
                        style={{ width: 120 }}
                    />
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                        Export
                    </Button>
                </Space>
            </div>

            <Row gutter={[24, 24]}>
                {/* Compliance by Agency */}
                <Col xs={24} md={12}>
                    <Card title={<Space><PieChartOutlined /> Compliance by Agency</Space>} bordered={false} loading={agencyLoading}>
                        {(agencyStats || []).map((agency) => (
                            <div key={agency.agency} className="reports-row">
                                <div className="reports-row-header">
                                    <Text strong>{agency.agency}</Text>
                                    <Text type="secondary">{agency.rate}%</Text>
                                </div>
                                <Progress percent={agency.rate} showInfo={false} strokeColor="#1890ff" />
                            </div>
                        ))}
                    </Card>
                </Col>

                {/* Monthly Submission Trend - Kept as placeholder for now as we don't track history trends easily yet */}
                <Col xs={24} md={12}>
                    <Card title={<Space><BarChartOutlined /> Submission Trends</Space>} bordered={false}>
                        <div className="reports-bars">
                            {[40, 65, 30, 85, 45, 90, 70].map((height, i) => (
                                <div key={i} className="reports-bar-col">
                                    <div
                                        className={`reports-bar reports-bar--${i}`}
                                        style={{ height: `${height}%` }}
                                    />
                                    <Text type="secondary" className="reports-bar-label">
                                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'][i]}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[24, 24]} className="reports-row-gap">
                <Col xs={24} lg={8}>
                    <Card bordered={false} className="reports-hero" loading={statsLoading}>
                        <FileProtectOutlined className="reports-hero-icon" />
                        <div className="reports-hero-label">Global Compliance Rate</div>
                        <div className="reports-hero-value">{stats?.compliance_rate || 0}%</div>
                        <div className="reports-hero-subtitle">Based on latest assignments</div>
                    </Card>
                </Col>

                <Col xs={24} lg={8}>
                    <Card bordered={false} loading={statsLoading}>
                        <Title level={5}>Compliance Status Breakdown</Title>
                        <Text type="secondary">Compliant vs Remaining</Text>
                        <Row className="reports-distribution">
                            <Col span={12} className="reports-distribution-col reports-distribution-col--border">
                                <Statistic title="Compliant" value={stats?.compliant || 0} className="reports-stat reports-stat--blue" />
                            </Col>
                            <Col span={12} className="reports-distribution-col">
                                <Statistic title="Pending" value={stats?.pending || 0} className="reports-stat reports-stat--purple" />
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col xs={24} lg={8}>
                    <Card bordered={false} loading={statsLoading}>
                        <div className="reports-critical">
                            <WarningOutlined className="reports-critical-icon" />
                            <Title level={5} className="reports-critical-title">Overdue Requirements</Title>
                        </div>
                        <div className="dashboard-center" style={{ padding: '20px 0' }}>
                            <Statistic value={stats?.overdue || 0} suffix="Requirements" valueStyle={{ color: '#ff4d4f' }} />
                            <Text type="secondary">Action required for compliance</Text>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ReportsPage;
