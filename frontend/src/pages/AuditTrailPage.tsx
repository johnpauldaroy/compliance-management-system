import { Table, Tag, Typography, Empty, Input, Select, Button, Space, Drawer, message, Radio, Descriptions } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { auditService } from '../services/apiService';
import { authService } from '../services/authService';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import './AuditTrailPage.css';

const { Title } = Typography;

type ExportType = 'csv' | 'xlsx' | 'pdf';

const AuditTrailPage = () => {
    const { data: logs, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['audit-logs'],
        queryFn: auditService.getLogs
    });

    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailRecord, setDetailRecord] = useState<any>(null);
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportType, setExportType] = useState<ExportType>('csv');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const logRows = logs || [];

    const actionOptions = useMemo(() => {
        const uniqueActions = Array.from(
            new Set(
                logRows
                    .map((row: any) => String(row.action || '').trim())
                    .filter((value: string) => value.length > 0)
            )
        ).sort();
        return ['all', ...uniqueActions];
    }, [logRows]);

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
            })
            .catch(() => {});

        return () => {
            isActive = false;
        };
    }, []);

    const filteredLogs = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return logRows.filter((row: any) => {
            if (actionFilter !== 'all' && String(row.action || '') !== actionFilter) {
                return false;
            }
            if (!term) {
                return true;
            }
            const actorName = String(row.actor?.employee_name || '').toLowerCase();
            const actorUserId = String(row.actor?.user_id || row.actor_user_id || '').toLowerCase();
            const action = String(row.action || '').toLowerCase();
            const ip = String(row.ip_address || '').toLowerCase();
            const entity = `${row.entity_type || ''} ${row.entity_id ?? ''}`.toLowerCase();
            return (
                actorName.includes(term) ||
                actorUserId.includes(term) ||
                action.includes(term) ||
                ip.includes(term) ||
                entity.includes(term)
            );
        });
    }, [actionFilter, logRows, searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [actionFilter, searchTerm, logRows.length]);

    const pagedLogs = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredLogs.slice(start, start + pageSize);
    }, [filteredLogs, page]);

    const handleExportCsv = () => {
        const headers = ['Actor', 'User ID', 'Action', 'Timestamp', 'IP Address'];
        const rows = filteredLogs.map((row: any) => [
            row.actor?.employee_name || 'N/A',
            row.actor?.user_id || row.actor_user_id || 'N/A',
            row.action || 'N/A',
            row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A',
            row.ip_address || 'N/A',
        ]);
        const csv = [headers, ...rows]
            .map((line) => line.map((value: string | number) => `"${String(value).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'audit-logs.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleExportXlsx = () => {
        const headers = ['Actor', 'User ID', 'Action', 'Timestamp', 'IP Address'];
        const rows = filteredLogs.map((row: any) => [
            row.actor?.employee_name || 'N/A',
            row.actor?.user_id || row.actor_user_id || 'N/A',
            row.action || 'N/A',
            row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A',
            row.ip_address || 'N/A',
        ]);
        const xmlRows = [headers, ...rows]
            .map((line) => `
                <Row>
                    ${line.map((value: string | number) => `<Cell><Data ss:Type="String">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>`).join('')}
                </Row>
            `)
            .join('');
        const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Audit Logs">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'audit-logs.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = () => {
        const rowsHtml = filteredLogs
            .map((row: any) => `
                <tr>
                    <td>${row.actor?.employee_name || 'N/A'}</td>
                    <td>${row.actor?.user_id || row.actor_user_id || 'N/A'}</td>
                    <td>${row.action || 'N/A'}</td>
                    <td>${row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A'}</td>
                    <td>${row.ip_address || 'N/A'}</td>
                </tr>
            `)
            .join('');

        const html = `
            <html>
                <head>
                    <title>Audit Logs</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; }
                        h1 { font-size: 20px; margin-bottom: 16px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
                        th { background: #f5f5f5; text-align: left; }
                    </style>
                </head>
                <body>
                    <h1>Audit Logs</h1>
                    <table>
                        <thead>
                            <tr>
                                <th>Actor</th>
                                <th>User ID</th>
                                <th>Action</th>
                                <th>Timestamp</th>
                                <th>IP Address</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            return;
        }
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const handleExport = () => {
        if (exportType === 'csv') {
            handleExportCsv();
            return;
        }
        if (exportType === 'xlsx') {
            handleExportXlsx();
            return;
        }
        handleExportPdf();
    };

    const columns: ColumnsType<any> = [
        {
            title: 'User Type',
            key: 'actor',
            render: (_, record) => (
                <div className="audit-actor">{record.actor?.user_type || 'N/A'}</div>
            ),
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => {
                const action = String(record.action || '').toLowerCase();
                const color = action.includes('delete') ? 'red' : action.includes('create') ? 'green' : 'blue';
                return (
                    <Tag color={color} className="audit-action-tag">
                        {String(record.action || 'unknown').toUpperCase()}
                    </Tag>
                );
            },
        },
        {
            title: 'User ID',
            key: 'user-id',
            render: (_, record) => (
                <span className="audit-muted">
                    {record.actor?.user_id || record.actor_user_id || 'N/A'}
                </span>
            ),
        },
        {
            title: 'IP Address',
            dataIndex: 'ip_address',
            key: 'ip',
            render: (ip) => <span className="audit-muted-light">{ip || 'N/A'}</span>,
        },
        {
            title: 'Timestamp',
            dataIndex: 'created_at',
            key: 'timestamp',
            defaultSortOrder: 'descend',
            sorter: (a, b) => {
                const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                return aTime - bTime;
            },
            render: (date) => (date ? new Date(date).toLocaleString() : 'N/A'),
        },
        ...(isSuperAdmin ? [{
            title: 'Detail',
            key: 'detail',
            render: (_: any, record: any) => (
                <Button
                    icon={<EyeOutlined />}
                    aria-label="View details"
                    onClick={() => {
                        setDetailRecord(record);
                        setDetailOpen(true);
                    }}
                />
            ),
        }] : []),
    ];

    return (
        <div className="audit-page">
            <Title level={2} className="audit-title">Audit Trail</Title>
            <Table
                columns={columns}
                dataSource={pagedLogs}
                rowKey="id"
                loading={isLoading}
                locale={{ emptyText: <Empty description="No audit logs" /> }}
                className="audit-table"
                pagination={{
                    current: page,
                    pageSize,
                    total: filteredLogs.length,
                    onChange: (nextPage, nextPageSize) => {
                        setPage(nextPage);
                        if (nextPageSize !== pageSize) {
                            setPageSize(nextPageSize);
                        }
                    },
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '25', '50'],
                }}
                title={() => (
                    <div className="audit-toolbar">
                        <Space wrap>
                            <Input
                                placeholder="Search audit logs"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                allowClear
                                className="audit-search"
                            />
                            <Select
                                value={actionFilter}
                                onChange={setActionFilter}
                                className="audit-filter"
                                options={actionOptions.map((action) => ({
                                    value: action,
                                    label: action === 'all' ? 'All actions' : action,
                                }))}
                            />
                            <Button
                                icon={<ReloadOutlined />}
                                loading={isFetching}
                                onClick={async () => {
                                    const key = 'audit-refresh';
                                    message.loading({ content: 'Data is refreshing...', key });
                                    await refetch();
                                    message.success({ content: 'Data is up to date.', key, duration: 2 });
                                }}
                            />
                        </Space>
                        <div className="audit-toolbar-right">
                            <Button type="primary" onClick={() => setIsExportOpen(true)}>Export</Button>
                        </div>
                    </div>
                )}
            />
            <Drawer
                title="Export audit logs"
                open={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                width={420}
                destroyOnClose
            >
                <Space direction="vertical" className="audit-export">
                    <Radio.Group
                        value={exportType}
                        onChange={(event) => setExportType(event.target.value)}
                        options={[
                            { label: 'CSV', value: 'csv' },
                            { label: 'XLSX', value: 'xlsx' },
                            { label: 'PDF', value: 'pdf' },
                        ]}
                    />
                    <div className="audit-drawer-footer">
                        <Button
                            type="primary"
                            onClick={() => {
                                handleExport();
                                setIsExportOpen(false);
                            }}
                        >
                            Export
                        </Button>
                    </div>
                </Space>
            </Drawer>
            <Drawer
                title="Audit Details"
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                width={720}
                destroyOnClose
            >
                <Space direction="vertical" className="audit-detail">
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="Action">
                            {detailRecord?.action || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="User">
                            {detailRecord?.actor?.employee_name || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Timestamp" span={2}>
                            {detailRecord?.created_at ? new Date(detailRecord.created_at).toLocaleString() : 'N/A'}
                        </Descriptions.Item>
                    </Descriptions>
                    <div>
                        <Typography.Text strong>Before</Typography.Text>
                        <pre className="audit-json">
                            {detailRecord?.before_json ? JSON.stringify(detailRecord.before_json, null, 2) : 'N/A'}
                        </pre>
                    </div>
                    <div>
                        <Typography.Text strong>After</Typography.Text>
                        <pre className="audit-json">
                            {detailRecord?.after_json ? JSON.stringify(detailRecord.after_json, null, 2) : 'N/A'}
                        </pre>
                    </div>
                </Space>
            </Drawer>
        </div>
    );
};

export default AuditTrailPage;
