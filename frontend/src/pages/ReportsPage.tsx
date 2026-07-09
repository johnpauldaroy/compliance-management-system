import { useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Empty, Form, Progress, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Bar, Pie } from '@ant-design/plots';
import { DownloadOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { agencyService, branchUnitDepartmentService, reportService, userService } from '../services/apiService';
import type { Agency, BranchUnitDepartment, ComplianceReportFilters, ComplianceReportResponse, ComplianceReportRow, ComplianceReportStatus, User } from '../types';
import './ReportsPage.css';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

type ReportFormValues = {
    date_range: [Dayjs, Dayjs];
    agency_id?: number;
    branch_unit_department_id?: number;
    user_id?: number;
    branch?: string;
    frequency?: string;
    status?: ComplianceReportStatus;
};

const statusOptions: { value: ComplianceReportStatus; label: string; color: string }[] = [
    { value: 'complied_on_time', label: 'Complied On Time', color: 'green' },
    { value: 'complied_late', label: 'Complied Late', color: 'orange' },
    { value: 'pending_approval', label: 'Pending for Approval', color: 'blue' },
    { value: 'pending_submission', label: 'Pending Submission', color: 'gold' },
    { value: 'overdue', label: 'Overdue', color: 'red' },
    { value: 'rejected', label: 'Rejected', color: 'volcano' },
];

const frequencyOptions = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'As Needed']
    .map((frequency) => ({ label: frequency, value: frequency }));

const statusColor = (status: ComplianceReportStatus) =>
    statusOptions.find((option) => option.value === status)?.color || 'default';

const attentionStatuses: ComplianceReportStatus[] = ['overdue', 'rejected', 'pending_approval', 'pending_submission', 'complied_late'];

const formatDate = (value?: string | null) => {
    if (!value) {
        return 'N/A';
    }
    return dayjs(value).format('MMM D, YYYY');
};

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return 'N/A';
    }
    return dayjs(value).format('MMM D, YYYY h:mm A');
};

const buildFilters = (values: ReportFormValues): ComplianceReportFilters => ({
    start_date: values.date_range[0].format('YYYY-MM-DD'),
    end_date: values.date_range[1].format('YYYY-MM-DD'),
    agency_id: values.agency_id,
    branch_unit_department_id: values.branch_unit_department_id,
    user_id: values.user_id,
    branch: values.branch,
    frequency: values.frequency,
    status: values.status,
});

const ReportsPage = () => {
    const [form] = Form.useForm<ReportFormValues>();
    const [filters, setFilters] = useState<ComplianceReportFilters>(() => ({
        start_date: dayjs().startOf('month').format('YYYY-MM-DD'),
        end_date: dayjs().endOf('month').format('YYYY-MM-DD'),
    }));

    const { data: agencies } = useQuery<Agency[]>({
        queryKey: ['agencies', 'reports'],
        queryFn: () => agencyService.getAll({ active_only: true }),
    });

    const { data: branchUnits } = useQuery<BranchUnitDepartment[]>({
        queryKey: ['branch-unit-departments', 'reports'],
        queryFn: () => branchUnitDepartmentService.getAll({ active_only: true }),
    });

    const { data: usersData } = useQuery({
        queryKey: ['users', 'reports'],
        queryFn: userService.getAll,
    });

    const users: User[] = usersData?.data || [];

    const {
        data: report,
        isLoading,
        isFetching,
        error,
        refetch,
    } = useQuery<ComplianceReportResponse>({
        queryKey: ['compliance-report', filters],
        queryFn: () => reportService.getCompliance(filters),
    });

    const branchOptions = useMemo(() => {
        return Array.from(new Set(users.map((user) => user.branch).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b))
            .map((branch) => ({ label: branch, value: branch }));
    }, [users]);

    const statusChartData = useMemo(() => {
        return (report?.status_breakdown || [])
            .filter((item) => item.count > 0)
            .map((item) => ({ status: item.label, count: item.count }));
    }, [report]);

    const userChartData = useMemo(() => {
        return (report?.user_breakdown || [])
            .slice()
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .flatMap((user) =>
                statusOptions.map((status) => ({
                    user: user.user_name || user.user_code || 'Unknown',
                    status: status.label,
                    count: user[status.value],
                }))
            )
            .filter((item) => item.count > 0);
    }, [report]);

    const agencyChartData = useMemo(() => {
        return (report?.agency_breakdown || [])
            .slice()
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .flatMap((agency) => [
                {
                    agency: agency.agency_code || agency.agency_name || 'Unknown',
                    status: 'On Time',
                    count: agency.complied_on_time,
                },
                {
                    agency: agency.agency_code || agency.agency_name || 'Unknown',
                    status: 'Late',
                    count: agency.complied_late,
                },
            ])
            .filter((item) => item.count > 0);
    }, [report]);

    const attentionRows = useMemo(() => {
        return (report?.rows || [])
            .filter((row) => attentionStatuses.includes(row.status))
            .slice()
            .sort((a, b) => {
                const severity: Record<ComplianceReportStatus, number> = {
                    overdue: 5,
                    rejected: 4,
                    pending_approval: 3,
                    pending_submission: 2,
                    complied_late: 1,
                    complied_on_time: 0,
                };
                return (severity[b.status] - severity[a.status]) || (b.days_late - a.days_late);
            })
            .slice(0, 8);
    }, [report]);

    const userAttentionRows = useMemo(() => {
        return (report?.user_breakdown || [])
            .map((user) => ({
                ...user,
                needs_attention: user.complied_late + user.pending_approval + user.pending_submission + user.overdue + user.rejected,
            }))
            .filter((user) => user.needs_attention > 0)
            .sort((a, b) => b.needs_attention - a.needs_attention)
            .slice(0, 6);
    }, [report]);

    const agencyAttentionRows = useMemo(() => {
        return (report?.agency_breakdown || [])
            .map((agency) => ({
                ...agency,
                needs_attention: agency.complied_late + agency.pending_approval + agency.pending_submission + agency.overdue + agency.rejected,
            }))
            .filter((agency) => agency.needs_attention > 0)
            .sort((a, b) => b.needs_attention - a.needs_attention)
            .slice(0, 6);
    }, [report]);

    const handleGenerate = (values: ReportFormValues) => {
        setFilters(buildFilters(values));
    };

    const handleExportPdf = () => {
        if (!report || report.rows.length === 0) {
            message.warning('Generate a report with rows before exporting.');
            return;
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(16);
        doc.text('Compliance Due Date Report', 40, 40);
        doc.setFontSize(9);
        doc.text(`Due date range: ${formatDate(report.start_date)} - ${formatDate(report.end_date)}`, 40, 58);
        doc.text(`Generated: ${dayjs().format('MMM D, YYYY h:mm A')}`, 40, 72);

        autoTable(doc, {
            startY: 88,
            head: [['Total Due', 'Requirements', 'Users', 'On Time', 'Late', 'Pending Approval', 'Pending Submission', 'Overdue', 'Rejected']],
            body: [[
                report.summary.total_due,
                report.summary.requirements,
                report.summary.users,
                report.summary.complied_on_time,
                report.summary.complied_late,
                report.summary.pending_approval,
                report.summary.pending_submission,
                report.summary.overdue,
                report.summary.rejected,
            ]],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [22, 119, 255] },
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Requirement', 'Agency', 'User', 'Branch', 'Deadline', 'Submitted', 'Approved', 'Status', 'Days Late / Overdue']],
            body: report.rows.map((row) => [
                `${row.requirement_code} - ${row.requirement}`,
                row.agency_code || row.agency_name || 'N/A',
                row.user_name || row.user_email || 'N/A',
                row.user_branch || 'N/A',
                formatDate(row.deadline),
                formatDateTime(row.submitted_at),
                formatDateTime(row.approved_at),
                row.status_label,
                row.days_late,
            ]),
            styles: { fontSize: 7, cellPadding: 3 },
            headStyles: { fillColor: [22, 119, 255] },
            columnStyles: {
                0: { cellWidth: 170 },
                1: { cellWidth: 85 },
                2: { cellWidth: 105 },
                3: { cellWidth: 80 },
                7: { cellWidth: 82 },
            },
        });

        doc.save(`compliance-report-${report.start_date}-to-${report.end_date}.pdf`);
    };

    const columns: ColumnsType<ComplianceReportRow> = [
        {
            title: 'Requirement',
            key: 'requirement',
            fixed: 'left',
            width: 260,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{record.requirement_code}</Text>
                    <Text>{record.requirement}</Text>
                </Space>
            ),
        },
        {
            title: 'Agency',
            key: 'agency',
            width: 140,
            render: (_, record) => record.agency_code || record.agency_name || 'N/A',
        },
        {
            title: 'User',
            key: 'user',
            width: 180,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Text>{record.user_name || 'N/A'}</Text>
                    <Text type="secondary">{record.user_email || record.user_code || ''}</Text>
                </Space>
            ),
        },
        {
            title: 'Branch',
            dataIndex: 'user_branch',
            key: 'user_branch',
            width: 130,
            render: (value) => value || 'N/A',
        },
        {
            title: 'Deadline',
            dataIndex: 'deadline',
            key: 'deadline',
            width: 120,
            render: (value) => formatDate(value),
            sorter: (a, b) => dayjs(a.deadline).unix() - dayjs(b.deadline).unix(),
        },
        {
            title: 'Submitted',
            dataIndex: 'submitted_at',
            key: 'submitted_at',
            width: 150,
            render: (value) => formatDateTime(value),
        },
        {
            title: 'Approved',
            dataIndex: 'approved_at',
            key: 'approved_at',
            width: 150,
            render: (value) => formatDateTime(value),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 160,
            render: (status: ComplianceReportStatus, record) => (
                <Tag color={statusColor(status)}>{record.status_label}</Tag>
            ),
            filters: statusOptions.map((status) => ({ text: status.label, value: status.value })),
            onFilter: (value, record) => record.status === value,
        },
        {
            title: 'Days Late / Overdue',
            dataIndex: 'days_late',
            key: 'days_late',
            width: 100,
            align: 'right',
            sorter: (a, b) => a.days_late - b.days_late,
        },
    ];

    const pieConfig: any = {
        data: statusChartData,
        angleField: 'count',
        colorField: 'status',
        radius: 0.78,
        label: {
            text: 'count',
            position: 'spider',
        },
        legend: {
            color: {
                position: 'bottom',
                layout: { justifyContent: 'center' },
            },
        },
    };

    const userBarConfig: any = {
        data: userChartData,
        xField: 'count',
        yField: 'user',
        colorField: 'status',
        stack: true,
        height: 320,
        legend: {
            color: {
                position: 'bottom',
            },
        },
    };

    const agencyBarConfig: any = {
        data: agencyChartData,
        xField: 'count',
        yField: 'agency',
        colorField: 'status',
        stack: true,
        height: 280,
        legend: {
            color: {
                position: 'bottom',
            },
        },
    };

    return (
        <div className="reports-page">
            <Space className="reports-header" wrap>
                <div>
                    <Title level={2} className="reports-title">Compliance Reports</Title>
                    <Text type="secondary">Generate user-level compliance results by due date range.</Text>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
                        Refresh
                    </Button>
                    <Button icon={<FilePdfOutlined />} type="primary" onClick={handleExportPdf} disabled={!report?.rows.length}>
                        Export PDF
                    </Button>
                </Space>
            </Space>

            {error ? (
                <Alert
                    type="error"
                    message="Unable to load report"
                    description={(error as any)?.response?.data?.message || 'Check the report filters and try again.'}
                    className="reports-alert"
                />
            ) : null}

            <div className="reports-filter-band">
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        date_range: [dayjs(filters.start_date), dayjs(filters.end_date)],
                    }}
                    onFinish={handleGenerate}
                >
                    <div className="reports-filter-grid">
                        <Form.Item
                            label="Due Date Range"
                            name="date_range"
                            rules={[{ required: true, message: 'Select a due date range.' }]}
                        >
                            <RangePicker allowClear={false} className="reports-control" />
                        </Form.Item>
                        <Form.Item label="Agency" name="agency_id">
                            <Select
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                placeholder="All agencies"
                                options={(agencies || []).map((agency) => ({
                                    label: `${agency.agency_id} - ${agency.name}`,
                                    value: agency.id,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item label="Branch/Unit/Department" name="branch_unit_department_id">
                            <Select
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                placeholder="All branch/unit/departments"
                                options={(branchUnits || []).map((unit) => ({
                                    label: unit.name,
                                    value: unit.id,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item label="PIC/User" name="user_id">
                            <Select
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                placeholder="All users"
                                options={users.map((user) => ({
                                    label: `${user.employee_name} (${user.email})`,
                                    value: user.id,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item label="User Branch" name="branch">
                            <Select
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                placeholder="All branches"
                                options={branchOptions}
                            />
                        </Form.Item>
                        <Form.Item label="Frequency" name="frequency">
                            <Select allowClear placeholder="All frequencies" options={frequencyOptions} />
                        </Form.Item>
                        <Form.Item label="Status" name="status">
                            <Select allowClear placeholder="All statuses" options={statusOptions.map(({ value, label }) => ({ value, label }))} />
                        </Form.Item>
                        <Form.Item label=" ">
                            <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} loading={isFetching} block>
                                Generate
                            </Button>
                        </Form.Item>
                    </div>
                </Form>
            </div>

            <div className="reports-summary-grid">
                <Statistic title="Total Due" value={report?.summary.total_due || 0} loading={isLoading} />
                <Statistic title="Requirements" value={report?.summary.requirements || 0} loading={isLoading} />
                <Statistic title="Users" value={report?.summary.users || 0} loading={isLoading} />
                <Statistic title="On Time" value={report?.summary.complied_on_time || 0} loading={isLoading} />
                <Statistic title="Late" value={report?.summary.complied_late || 0} loading={isLoading} />
                <Statistic title="Pending Approval" value={report?.summary.pending_approval || 0} loading={isLoading} />
                <Statistic title="Pending Submission" value={report?.summary.pending_submission || 0} loading={isLoading} />
                <Statistic title="Overdue" value={report?.summary.overdue || 0} loading={isLoading} />
            </div>

            <section className="reports-section">
                <div className="reports-section-header">
                    <Typography.Title level={4}>Compliance Overview</Typography.Title>
                    <Text type="secondary">Due-date performance for the selected range</Text>
                </div>
                <div className="reports-kpi-grid">
                    <div className="reports-kpi">
                        <Text type="secondary">Completion Rate</Text>
                        <Progress
                            type="dashboard"
                            percent={report?.summary.completion_rate || 0}
                            size={108}
                            strokeColor="#16a34a"
                        />
                        <Text>{report?.summary.completed || 0} of {report?.summary.total_due || 0} completed</Text>
                    </div>
                    <div className="reports-kpi">
                        <Text type="secondary">On-Time Rate</Text>
                        <Progress
                            type="dashboard"
                            percent={report?.summary.on_time_rate || 0}
                            size={108}
                            strokeColor="#0ea5e9"
                        />
                        <Text>{report?.summary.complied_on_time || 0} on-time completions</Text>
                    </div>
                    <div className="reports-kpi">
                        <Text type="secondary">Open Work</Text>
                        <Progress
                            type="dashboard"
                            percent={report?.summary.open_rate || 0}
                            size={108}
                            strokeColor="#f59e0b"
                        />
                        <Text>{report?.summary.open || 0} unresolved assignment(s)</Text>
                    </div>
                    <div className="reports-kpi reports-kpi--numbers">
                        <Statistic title="Late / Overdue / Rejected" value={report?.summary.late_or_overdue || 0} loading={isLoading} />
                        <Statistic title="Average Days Late" value={report?.summary.avg_days_late || 0} precision={1} loading={isLoading} />
                        <Statistic title="Maximum Days Late" value={report?.summary.max_days_late || 0} loading={isLoading} />
                    </div>
                </div>
            </section>

            {report && report.rows.length === 0 ? (
                <Empty className="reports-empty" description="No due assignments found for the selected range." />
            ) : (
                <>
                    <div className="reports-attention-grid">
                        <section className="reports-section">
                            <div className="reports-section-header">
                                <Typography.Title level={4}>Immediate Follow-Up</Typography.Title>
                                <Text type="secondary">{attentionRows.length} priority row(s)</Text>
                            </div>
                            <Table
                                size="small"
                                rowKey={(row) => `attention-${row.assignment_id}-${row.deadline}`}
                                dataSource={attentionRows}
                                pagination={false}
                                columns={[
                                    {
                                        title: 'User',
                                        key: 'user',
                                        render: (_, row) => row.user_name || row.user_email || 'N/A',
                                    },
                                    {
                                        title: 'Requirement',
                                        key: 'requirement',
                                        render: (_, row) => row.requirement_code,
                                    },
                                    {
                                        title: 'Deadline',
                                        dataIndex: 'deadline',
                                        key: 'deadline',
                                        render: formatDate,
                                    },
                                    {
                                        title: 'Status',
                                        dataIndex: 'status',
                                        key: 'status',
                                        render: (status: ComplianceReportStatus, row) => <Tag color={statusColor(status)}>{row.status_label}</Tag>,
                                    },
                                    {
                                        title: 'Days',
                                        dataIndex: 'days_late',
                                        key: 'days_late',
                                        align: 'right',
                                    },
                                ]}
                            />
                        </section>
                        <section className="reports-section">
                            <div className="reports-section-header">
                                <Typography.Title level={4}>Users Needing Attention</Typography.Title>
                                <Text type="secondary">Ranked by unresolved and late work</Text>
                            </div>
                            <Table
                                size="small"
                                rowKey={(row) => `user-${row.user_id || row.user_name}`}
                                dataSource={userAttentionRows}
                                pagination={false}
                                columns={[
                                    {
                                        title: 'User',
                                        key: 'user',
                                        render: (_, row) => (
                                            <Space direction="vertical" size={0}>
                                                <Text>{row.user_name || 'Unknown'}</Text>
                                                <Text type="secondary">{row.user_branch || 'N/A'}</Text>
                                            </Space>
                                        ),
                                    },
                                    {
                                        title: 'Attention',
                                        dataIndex: 'needs_attention',
                                        key: 'needs_attention',
                                        align: 'right',
                                    },
                                    {
                                        title: 'Overdue',
                                        dataIndex: 'overdue',
                                        key: 'overdue',
                                        align: 'right',
                                    },
                                    {
                                        title: 'Pending',
                                        key: 'pending',
                                        align: 'right',
                                        render: (_, row) => row.pending_approval + row.pending_submission,
                                    },
                                ]}
                            />
                        </section>
                        <section className="reports-section">
                            <div className="reports-section-header">
                                <Typography.Title level={4}>Agencies Needing Attention</Typography.Title>
                                <Text type="secondary">Ranked by unresolved and late work</Text>
                            </div>
                            <Table
                                size="small"
                                rowKey={(row) => `agency-${row.agency_id || row.agency_name}`}
                                dataSource={agencyAttentionRows}
                                pagination={false}
                                columns={[
                                    {
                                        title: 'Agency',
                                        key: 'agency',
                                        render: (_, row) => row.agency_code || row.agency_name || 'N/A',
                                    },
                                    {
                                        title: 'Attention',
                                        dataIndex: 'needs_attention',
                                        key: 'needs_attention',
                                        align: 'right',
                                    },
                                    {
                                        title: 'Late',
                                        dataIndex: 'complied_late',
                                        key: 'complied_late',
                                        align: 'right',
                                    },
                                    {
                                        title: 'Overdue',
                                        dataIndex: 'overdue',
                                        key: 'overdue',
                                        align: 'right',
                                    },
                                ]}
                            />
                        </section>
                    </div>

                    <div className="reports-chart-grid">
                        <section className="reports-section reports-section--compact">
                            <Typography.Title level={4}>Status Breakdown</Typography.Title>
                            {statusChartData.length ? <Pie {...pieConfig} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                        </section>
                        <section className="reports-section">
                            <Typography.Title level={4}>Top Users by Status</Typography.Title>
                            {userChartData.length ? <Bar {...userBarConfig} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                        </section>
                        <section className="reports-section reports-section--wide">
                            <Typography.Title level={4}>Agency On-Time vs Late</Typography.Title>
                            {agencyChartData.length ? <Bar {...agencyBarConfig} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                        </section>
                    </div>

                    <section className="reports-section">
                        <div className="reports-section-header">
                            <Typography.Title level={4}>Detailed User Results</Typography.Title>
                            <Text type="secondary">{report?.rows.length || 0} row(s)</Text>
                        </div>
                        <Table
                            columns={columns}
                            dataSource={report?.rows || []}
                            rowKey={(row) => `${row.assignment_id}-${row.deadline}`}
                            loading={isLoading}
                            scroll={{ x: 1390 }}
                            pagination={{ pageSize: 20, showSizeChanger: true }}
                        />
                    </section>
                </>
            )}
        </div>
    );
};

export default ReportsPage;
