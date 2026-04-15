import { Card, Row, Col, Statistic, Typography as AntTypography, Space, List, Modal, Button, Empty, Tag, Form, Select, message } from 'antd';
import {
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    BankOutlined,
    BarChartOutlined,
    FileProtectOutlined,
    CalendarOutlined,
    EyeOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { Calendar } from 'react-vant';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardService, requirementService, uploadService } from '../services/apiService';
import { authService } from '../services/authService';
import { getAccessLevel } from '../lib/access';
import { useNavigate } from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import './Dashboard.css';

const { Text } = AntTypography;

const Dashboard = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: dashboardService.getStats,
    });

    const { data: meData } = useQuery({
        queryKey: ['me'],
        queryFn: authService.me,
    });

    const accessLevel = getAccessLevel(meData?.user?.roles || []);
    const isPic = accessLevel === 'pic';
    const currentUserId = meData?.user?.id;
    const isAdmin = accessLevel === 'admin' || accessLevel === 'super';

    const { data: agencyStats, isLoading: agencyLoading } = useQuery({
        queryKey: ['agency-stats'],
        queryFn: dashboardService.getAgencyStats,
    });

    const { data: calendarData } = useQuery({
        queryKey: ['dashboard-calendar'],
        queryFn: dashboardService.getCalendar,
    });

    const { data: licenseRequirements, isLoading: licenseLoading } = useQuery({
        queryKey: ['requirements', 'license-dashboard'],
        queryFn: () => requirementService.getAll({ category: 'License', per_page: 200 }),
    });

    const { data: permitRequirements, isLoading: permitLoading } = useQuery({
        queryKey: ['requirements', 'permit-dashboard'],
        queryFn: () => requirementService.getAll({ category: 'Permit', per_page: 200 }),
    });

    const { data: certificationRequirements, isLoading: certificationLoading } = useQuery({
        queryKey: ['requirements', 'certification-dashboard'],
        queryFn: () => requirementService.getAll({ category: 'Certification', per_page: 200 }),
    });

    const { data: myRequirements, isLoading: myRequirementsLoading } = useQuery({
        queryKey: ['requirements', 'my'],
        queryFn: requirementService.getMine,
        enabled: Boolean(meData) && isPic,
    });

    const { data: allRequirements } = useQuery({
        queryKey: ['requirements', 'all-dashboard'],
        queryFn: () => requirementService.getAll({ per_page: 5000 }),
        enabled: isAdmin,
    });

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailRequirementId, setDetailRequirementId] = useState<number | null>(null);
    const [selectedDateLabel, setSelectedDateLabel] = useState('Select a date');
    const [selectedDateItems, setSelectedDateItems] = useState<Array<{
        id: number;
        req_id?: string;
        name: string;
        status: string;
        pic?: string;
        pic_details?: Array<{
            id: number;
            user_id?: number;
            name: string;
            status: string;
            submitted_at?: string | null;
            approved_at?: string | null;
        }>;
    }>>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [picStatusModalOpen, setPicStatusModalOpen] = useState(false);
    const [picStatusModalItem, setPicStatusModalItem] = useState<{
        id: number;
        req_id?: string;
        name: string;
        pic_details?: Array<{
            id: number;
            user_id?: number;
            name: string;
            status: string;
            submitted_at?: string | null;
            approved_at?: string | null;
        }>;
    } | null>(null);
    const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(dayjs().startOf('month').toDate());
    const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
    const [deadlineSubmitting, setDeadlineSubmitting] = useState(false);
    const [deadlineForm] = Form.useForm();
    const calendarLayoutRef = useRef<HTMLDivElement | null>(null);
    const calendarLegendRef = useRef<HTMLDivElement | null>(null);
    const calendarToolbarRef = useRef<HTMLDivElement | null>(null);
    const calendarWidgetRef = useRef<HTMLDivElement | null>(null);

    const { data: requirementDetail, isLoading: detailLoading } = useQuery({
        queryKey: ['requirement-detail', detailRequirementId],
        queryFn: () => requirementService.show(detailRequirementId as number),
        enabled: Boolean(detailRequirementId),
    });

    const combinedRequirements = useMemo(() => {
        const list = [
            ...(licenseRequirements?.data || []),
            ...(permitRequirements?.data || []),
            ...(certificationRequirements?.data || []),
        ];
        return list.sort((a, b) => String(a.requirement || '').localeCompare(String(b.requirement || ''), undefined, { sensitivity: 'base' }));
    }, [licenseRequirements, permitRequirements, certificationRequirements]);

    const statusLegend = [
        { key: 'pending', label: 'Pending', className: 'status-pending' },
        { key: 'complied', label: 'Complied', className: 'status-complied' },
        { key: 'na', label: 'N/A', className: 'status-na' },
        { key: 'overdue', label: 'Overdue', className: 'status-overdue' },
    ];

    const calendarLegend = useMemo(() => {
        if (isPic) {
            return [
                { key: 'pending', label: 'Pending', className: 'status-pending' },
                { key: 'for_approval', label: 'Awaiting Approval', className: 'status-approval' },
                { key: 'complied', label: 'Complied', className: 'status-complied' },
                { key: 'overdue', label: 'Overdue', className: 'status-overdue' },
            ];
        }
        return [
            { key: 'pending', label: 'Pending', className: 'status-pending' },
            { key: 'complied', label: 'Complied', className: 'status-complied' },
            { key: 'overdue', label: 'Overdue', className: 'status-overdue' },
            { key: 'for_approval', label: 'For Approval', className: 'status-approval' },
        ];
    }, [isPic]);

    const calendarMap = useMemo(() => calendarData || {}, [calendarData]);

    const calendarMinDate = useMemo(
        () => dayjs(calendarViewMonth).startOf('month').toDate(),
        [calendarViewMonth]
    );

    const calendarMaxDate = useMemo(
        () => dayjs(calendarViewMonth).endOf('month').toDate(),
        [calendarViewMonth]
    );

    const calendarMonthLabel = useMemo(
        () => dayjs(calendarViewMonth).format('MMMM YYYY').toUpperCase(),
        [calendarViewMonth]
    );

    const calendarStatusByDate = useMemo(() => {
        const map = new Map<string, string>();
        Object.entries(calendarMap).forEach(([dateKey, items]) => {
            if (!items || !items.length) {
                return;
            }
            const uniqueStatuses = Array.from(new Set(items.map((item) => item.status)));
            if (uniqueStatuses.length > 1) {
                map.set(dateKey, 'multi');
                return;
            }
            map.set(dateKey, uniqueStatuses[0]);
        });
        return map;
    }, [calendarMap]);

    useEffect(() => {
        if (selectedDate) {
            return;
        }
        const today = dayjs();
        const dateKey = today.format('YYYY-MM-DD');
        setSelectedDate(today.toDate());
        setSelectedDateLabel(today.format('MMMM D, YYYY'));
        setSelectedDateItems(calendarMap[dateKey] || []);
    }, [calendarMap, selectedDate]);

    useEffect(() => {
        if (!selectedDate) {
            return;
        }
        if (dayjs(selectedDate).isSame(calendarViewMonth, 'month')) {
            return;
        }
        const nextDate = dayjs(calendarViewMonth).startOf('month').toDate();
        const dateKey = dayjs(nextDate).format('YYYY-MM-DD');
        setSelectedDate(nextDate);
        setSelectedDateLabel(dayjs(nextDate).format('MMMM D, YYYY'));
        setSelectedDateItems(calendarMap[dateKey] || []);
    }, [calendarMap, calendarViewMonth, selectedDate]);

    useLayoutEffect(() => {
        const layout = calendarLayoutRef.current;
        if (!layout) {
            return;
        }

        const updateMeasurements = () => {
            const legendHeight = calendarLegendRef.current?.offsetHeight || 0;
            const toolbarHeight = calendarToolbarRef.current?.offsetHeight || 0;
            const offset = legendHeight + toolbarHeight;
            layout.style.setProperty('--calendar-grid-offset', `${offset}px`);

            const calendarEl = calendarWidgetRef.current;
            const panelEl = layout.querySelector('.dashboard-calendar-panel') as HTMLElement | null;
            if (!calendarEl || !panelEl) {
                return;
            }
            const monthEl = calendarEl.querySelector('.rv-calendar__month') as HTMLElement | null;
            const bodyEl = calendarEl.querySelector('.rv-calendar__body') as HTMLElement | null;
            const target = monthEl || bodyEl || calendarEl;
            if (target?.offsetHeight) {
                const panelStyles = window.getComputedStyle(panelEl);
                const panelPaddingTop = parseFloat(panelStyles.paddingTop || '0') || 0;
                const panelPaddingBottom = parseFloat(panelStyles.paddingBottom || '0') || 0;
                const panelBorderTop = parseFloat(panelStyles.borderTopWidth || '0') || 0;
                const panelBorderBottom = parseFloat(panelStyles.borderBottomWidth || '0') || 0;
                const panelExtra = panelPaddingTop + panelPaddingBottom + panelBorderTop + panelBorderBottom;
                layout.style.setProperty('--calendar-grid-height', `${target.offsetHeight + panelExtra}px`);
            }
        };

        updateMeasurements();
        const observer = new ResizeObserver(updateMeasurements);
        if (calendarLegendRef.current) observer.observe(calendarLegendRef.current);
        if (calendarToolbarRef.current) observer.observe(calendarToolbarRef.current);
        if (calendarWidgetRef.current) observer.observe(calendarWidgetRef.current);

        return () => observer.disconnect();
    }, [calendarViewMonth, selectedDateItems.length]);

    const normalizeStatus = (value?: string | null) => {
        const text = (value || '').toLowerCase();
        if (!text || text === 'n/a' || text === 'na') {
            return 'na';
        }
        if (text.includes('late') || text.includes('overdue')) {
            return 'overdue';
        }
        if (text.includes('complied')) {
            return 'complied';
        }
        if (text.includes('pending')) {
            return 'pending';
        }
        return 'na';
    };

    const statusClass = (status: string) => {
        if (status === 'for_approval') {
            return 'status-approval';
        }
        return `status-${status}`;
    };

    const getOverallStatusLabel = (item: {
        status: string;
        pic_details?: Array<{ status: string }>;
    }) => {
        const base = item.status.replace('_', ' ').toUpperCase();
        if (!isAdmin) {
            return base;
        }
        const details = item.pic_details || [];
        if (!details.length) {
            return base;
        }
        const approvedCount = details.filter((detail) => detail.status === 'complied').length;
        const percent = Math.round((approvedCount / details.length) * 100);
        return `${base} (${percent}%)`;
    };

    const isMonthlyFrequency = (value?: string | null) => (value || '').toLowerCase().includes('month');

    const canUpdateDeadline = (requirement: any) => {
        if (!requirement?.deadline) {
            return true;
        }
        const status = String(requirement.compliance_status || '').toUpperCase();
        return status === 'COMPLIED' || status === 'APPROVED';
    };

    const handleOpenDeadlineModal = () => {
        deadlineForm.setFieldsValue({ requirement_id: undefined });
        setDeadlineModalOpen(true);
    };

    const handleDeadlineSubmit = async () => {
        try {
            const values = await deadlineForm.validateFields();
            const requirementId = Number(values.requirement_id);
            const deadlineValue = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : '';
            if (!deadlineValue) {
                message.error('Select a date on the calendar first.');
                return;
            }
            const requirement = allRequirements?.data?.find((item) => item.id === requirementId);
            if (!requirement) {
                message.error('Select a requirement.');
                return;
            }
            const hasPicAssignments = (requirement.assignments || []).length > 0;
            const hasPicIds = Boolean(String(requirement.person_in_charge_user_ids || '').trim());
            if (!hasPicAssignments && !hasPicIds) {
                message.error("There's no Person-in-Charge set for this requirement yet. Please go to the Requirements page and set the PIC before setting a deadline.");
                return;
            }
            if (isMonthlyFrequency(requirement.frequency)) {
                message.error(`${requirement.req_id} is auto-assigned monthly. Please go to the Requirements page to update it.`);
                return;
            }
            if (!canUpdateDeadline(requirement)) {
                const parsedDeadline = requirement.deadline ? dayjs(requirement.deadline) : null;
                const deadlineLabel = parsedDeadline?.isValid()
                    ? parsedDeadline.format('MMMM D, YYYY')
                    : 'the current deadline';
                message.error(`This requirement has not been complied for the deadline set on ${deadlineLabel}. Please go to the Requirements page to change it.`);
                return;
            }
            setDeadlineSubmitting(true);
            await requirementService.update(requirementId, { deadline: deadlineValue });
            message.success('Deadline updated.');
            setDeadlineModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['dashboard-calendar'] });
            queryClient.invalidateQueries({ queryKey: ['requirements', 'all-dashboard'] });
        } catch (error) {
            if (!String(error).includes('validation')) {
                message.error('Failed to update deadline.');
            }
        } finally {
            setDeadlineSubmitting(false);
        }
    };

    const handleCalendarSelect = (value: Date | Date[]) => {
        const selected = Array.isArray(value) ? value[0] : value;
        if (!selected) {
            return;
        }
        const dateKey = dayjs(selected).format('YYYY-MM-DD');
        setSelectedDate(selected);
        setSelectedDateLabel(dayjs(selected).format('MMMM D, YYYY'));
        setSelectedDateItems(calendarMap[dateKey] || []);
    };

    const handlePrevMonth = () => {
        setCalendarViewMonth(dayjs(calendarViewMonth).subtract(1, 'month').toDate());
    };

    const handleNextMonth = () => {
        setCalendarViewMonth(dayjs(calendarViewMonth).add(1, 'month').toDate());
    };

    const handlePrevYear = () => {
        setCalendarViewMonth(dayjs(calendarViewMonth).subtract(1, 'year').toDate());
    };

    const handleNextYear = () => {
        setCalendarViewMonth(dayjs(calendarViewMonth).add(1, 'year').toDate());
    };

    const latestSubmission = useMemo(() => {
        const submissions = requirementDetail?.submissions || [];
        if (!submissions.length) {
            return null;
        }
        return submissions
            .slice()
            .sort((a: any, b: any) => {
                const aTime = new Date(a.upload_date || a.created_at || 0).getTime();
                const bTime = new Date(b.upload_date || b.created_at || 0).getTime();
                return bTime - aTime;
            })[0];
    }, [requirementDetail]);

    const handleOpenDetail = (id: number) => {
        setDetailRequirementId(id);
        setDetailOpen(true);
    };

    const handleViewFile = async (submissionId: number, uploadId: number) => {
        try {
            const { url } = await uploadService.getSignedUrl(submissionId, uploadId, true);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            // noop: use a simple fallback to avoid noisy dashboard errors
        }
    };

    const kpiCards = [
        { title: 'Total Agencies', value: stats?.total_agencies || 0, icon: <BankOutlined />, colorClass: 'dashboard-stat--blue', to: '/agencies' },
        { title: 'Total Requirements', value: stats?.total_requirements || 0, icon: <FileTextOutlined />, colorClass: 'dashboard-stat--blue', to: '/requirements' },
        { title: 'Compliant', value: stats?.compliant || 0, icon: <CheckCircleOutlined />, colorClass: 'dashboard-stat--green', to: '/requirements?status=compliant' },
        { title: 'Pending', value: stats?.pending || 0, icon: <ClockCircleOutlined />, colorClass: 'dashboard-stat--gold', to: '/requirements?status=pending' },
        { title: 'Overdue', value: stats?.overdue || 0, icon: <WarningOutlined />, colorClass: 'dashboard-stat--red', to: '/requirements?status=overdue' },
        { title: 'For Approval', value: stats?.for_approval || 0, icon: <FileProtectOutlined />, colorClass: 'dashboard-stat--purple', to: '/uploads' },
    ];

    const picStats = useMemo(() => {
        const list = myRequirements || [];
        let pending = 0;
        let awaitingApproval = 0;
        let overdue = 0;
        let complied = 0;

        list.forEach((req) => {
            const status = String(req.compliance_status || '').toUpperCase();
            if (status === 'APPROVED') {
                complied += 1;
            } else if (status === 'OVERDUE') {
                overdue += 1;
            } else if (status === 'SUBMITTED') {
                awaitingApproval += 1;
            } else if (status === 'PENDING' || status === 'REJECTED') {
                pending += 1;
            }
        });

        return {
            totalAssigned: list.length,
            pending,
            awaitingApproval,
            overdue,
            complied,
        };
    }, [myRequirements]);

    const picKpiCards = [
        { title: 'Total Requirements', value: picStats.totalAssigned, icon: <FileTextOutlined />, colorClass: 'dashboard-stat--blue' },
        { title: 'Pending', value: picStats.pending, icon: <ClockCircleOutlined />, colorClass: 'dashboard-stat--gold' },
        { title: 'Awaiting Approval', value: picStats.awaitingApproval, icon: <FileProtectOutlined />, colorClass: 'dashboard-stat--purple' },
        { title: 'Overdue', value: picStats.overdue, icon: <WarningOutlined />, colorClass: 'dashboard-stat--red' },
        { title: 'Complied', value: picStats.complied, icon: <CheckCircleOutlined />, colorClass: 'dashboard-stat--green' },
    ];

    return (
        <div className="dashboard-page">
            {isPic ? (
                <Row gutter={[16, 16]} className="dashboard-kpi-row dashboard-kpi-row--pic" justify="space-between">
                    {picKpiCards.map((stat, index) => (
                        <Col xs={24} sm={12} md={8} key={index} flex="1 1 220px">
                            <Card
                                className={`dashboard-stat dashboard-kpi-card dashboard-kpi-card--static ${stat.colorClass}`}
                                loading={myRequirementsLoading}
                                variant="outlined"
                            >
                                <Statistic
                                    title={stat.title}
                                    value={stat.value}
                                    prefix={<span className="dashboard-stat-icon">{stat.icon}</span>}
                                />
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Row gutter={[16, 16]} className="dashboard-kpi-row">
                    {kpiCards.map((stat, index) => (
                        <Col xs={24} sm={12} md={8} lg={4} key={index}>
                            <Card
                                className={`dashboard-stat dashboard-kpi-card ${stat.colorClass}`}
                                loading={statsLoading}
                                variant="outlined"
                                onClick={() => stat.to && navigate(stat.to)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && stat.to) {
                                        navigate(stat.to);
                                    }
                                }}
                            >
                                <Statistic
                                    title={stat.title}
                                    value={stat.value}
                                    prefix={<span className="dashboard-stat-icon">{stat.icon}</span>}
                                />
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            <Row gutter={[16, 16]} className="dashboard-row">
                <Col xs={24}>
                    <Card title={<Space><CalendarOutlined /> Calendar</Space>} variant="outlined">
                        <div className="dashboard-calendar-layout" ref={calendarLayoutRef}>
                            <div className="dashboard-calendar-calendar">
                                <div className="dashboard-calendar-legend" ref={calendarLegendRef}>
                                    {calendarLegend.map((item) => (
                                        <div key={item.key} className="dashboard-status-legend-item">
                                            <span className={`dashboard-status-swatch ${item.className}`} />
                                            <Text type="secondary">{item.label}</Text>
                                        </div>
                                    ))}
                                </div>
                                <div className="dashboard-calendar-toolbar" ref={calendarToolbarRef}>
                                    <div className="dashboard-calendar-toolbar-group">
                                        <button
                                            type="button"
                                            className="dashboard-calendar-nav-btn"
                                            onClick={handlePrevYear}
                                            aria-label="Previous year"
                                        >
                                            «
                                        </button>
                                        <button
                                            type="button"
                                            className="dashboard-calendar-nav-btn"
                                            onClick={handlePrevMonth}
                                            aria-label="Previous month"
                                        >
                                            ‹
                                        </button>
                                    </div>
                                    <div className="dashboard-calendar-month">{calendarMonthLabel}</div>
                                    <div className="dashboard-calendar-toolbar-group">
                                        <button
                                            type="button"
                                            className="dashboard-calendar-nav-btn"
                                            onClick={handleNextMonth}
                                            aria-label="Next month"
                                        >
                                            ›
                                        </button>
                                        <button
                                            type="button"
                                            className="dashboard-calendar-nav-btn"
                                            onClick={handleNextYear}
                                            aria-label="Next year"
                                        >
                                            »
                                        </button>
                                    </div>
                                </div>
                                <div ref={calendarWidgetRef}>
                                    <Calendar
                                        className="dashboard-calendar-vant"
                                        poppable={false}
                                        showConfirm={false}
                                        showSubtitle={false}
                                        showTitle={false}
                                        showMark={false}
                                        type="single"
                                        value={selectedDate || new Date()}
                                        firstDayOfWeek={1}
                                        weekdays={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                                        minDate={calendarMinDate}
                                        maxDate={calendarMaxDate}
                                        formatMonthTitle={(date) => dayjs(date).format('MMMM YYYY').toUpperCase()}
                                        formatter={(day) => {
                                            if (!day.date) {
                                                return day;
                                            }
                                        const dateKey = dayjs(day.date).format('YYYY-MM-DD');
                                        const status = calendarStatusByDate.get(dateKey);
                                        const isSunday = dayjs(day.date).day() === 0;
                                        const isToday = dayjs(day.date).isSame(dayjs(), 'day');
                                        const classes = ['dashboard-calendar-day'];
                                        if (isSunday) {
                                            classes.push('dashboard-calendar-day--sunday');
                                        }
                                        if (isToday) {
                                            classes.push('dashboard-calendar-day--today');
                                        }
                                        if (status) {
                                            classes.push('dashboard-calendar-day--has-status');
                                        }
                                        if (!status) {
                                            return {
                                                ...day,
                                                className: classes.join(' '),
                                            };
                                            }
                                            return {
                                                ...day,
                                                className: [...classes, `dashboard-calendar-day--${status}`].join(' '),
                                            };
                                        }}
                                    onSelect={handleCalendarSelect}
                                />
                            </div>
                            </div>
                            <div className="dashboard-calendar-panel">
                                <div className="dashboard-calendar-panel-header">
                                    <div>
                                        <Text strong className="dashboard-calendar-panel-title">Compliance due on {selectedDateLabel}</Text>
                                        <div className="dashboard-calendar-panel-subtitle">
                                            {selectedDateItems.length} item{selectedDateItems.length === 1 ? '' : 's'}
                                        </div>
                                    </div>
                                    {isAdmin ? (
                                        <Button type="primary" onClick={handleOpenDeadlineModal}>
                                            Set deadline
                                        </Button>
                                    ) : null}
                                </div>
                                {selectedDateItems.length ? (
                                    <List
                                        dataSource={selectedDateItems}
                                        className="dashboard-calendar-list dashboard-calendar-list--cards"
                                        renderItem={(item) => (
                                            <List.Item className="dashboard-calendar-item dashboard-calendar-item--card">
                                                <div className="dashboard-calendar-item-content">
                                                    <div className="dashboard-calendar-item-title-row">
                                                        <div className="dashboard-calendar-item-title">{item.name}</div>
                                                        <div className="dashboard-calendar-item-id-row">
                                                            <span className="dashboard-calendar-item-id-label">Req ID</span>
                                                            <span className="dashboard-calendar-item-id-value">{item.req_id || `REQ-${item.id}`}</span>
                                                        </div>
                                                    </div>
                                                    <div className="dashboard-calendar-item-status">
                                                        <div className="dashboard-calendar-item-status-left">
                                                            <span className="dashboard-calendar-item-status-label">Overall status</span>
                                                            <Tag className={`dashboard-status-tag ${statusClass(item.status)}`}>
                                                                {getOverallStatusLabel(item)}
                                                            </Tag>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="dashboard-calendar-item-info-btn"
                                                            aria-label={`View PIC status for ${item.name}`}
                                                            onClick={() => {
                                                                setPicStatusModalItem({
                                                                    id: item.id,
                                                                    req_id: item.req_id,
                                                                    name: item.name,
                                                                    pic_details: item.pic_details || [],
                                                                });
                                                                setPicStatusModalOpen(true);
                                                            }}
                                                        >
                                                            <InfoCircleOutlined />
                                                        </button>
                                                    </div>
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                ) : (
                                    <Empty description="Pick a date to see requirements" />
                                )}
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>
            <Modal
                title="Person-in-Charge Status Details"
                open={picStatusModalOpen}
                onCancel={() => setPicStatusModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                {picStatusModalItem ? (
                    <div className="dashboard-calendar-pic-modal">
                        <div className="dashboard-calendar-pic-modal-title">
                            <div className="dashboard-calendar-pic-modal-name">{picStatusModalItem.name}</div>
                            <div className="dashboard-calendar-pic-modal-meta">
                                Req ID: {picStatusModalItem.req_id || `REQ-${picStatusModalItem.id}`}
                            </div>
                        </div>
                        {picStatusModalItem.pic_details?.length ? (
                            <div className="dashboard-calendar-item-pic-grid">
                                {picStatusModalItem.pic_details.map((pic) => (
                                    <div key={pic.id} className="dashboard-calendar-item-pic-chip">
                                        <div className="dashboard-calendar-item-pic-info">
                                            <span className="dashboard-calendar-item-pic-name">{pic.name}</span>
                                        </div>
                                        <div className="dashboard-calendar-item-pic-status">
                                            <Tag className={`dashboard-status-tag ${statusClass(pic.status)}`}>
                                                {pic.status.replace('_', ' ').toUpperCase()}
                                            </Tag>
                                            {(() => {
                                                if (pic.status === 'complied') {
                                                    const date = pic.approved_at || pic.submitted_at;
                                                    return date ? (
                                                        <span className="dashboard-calendar-item-pic-date">
                                                            Approved {new Date(date).toLocaleString()}
                                                        </span>
                                                    ) : null;
                                                }
                                                if (pic.status === 'for_approval') {
                                                    return pic.submitted_at ? (
                                                        <span className="dashboard-calendar-item-pic-date">
                                                            Submitted {new Date(pic.submitted_at).toLocaleString()}
                                                        </span>
                                                    ) : null;
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Empty description="No PIC status available" />
                        )}
                    </div>
                ) : (
                    <Empty description="No PIC status available" />
                )}
            </Modal>
            {isAdmin ? (
                <Modal
                    title="Set requirement deadline"
                    open={deadlineModalOpen}
                    onCancel={() => setDeadlineModalOpen(false)}
                    onOk={handleDeadlineSubmit}
                    okText="Save deadline"
                    confirmLoading={deadlineSubmitting}
                    destroyOnClose
                >
                    <Form layout="vertical" form={deadlineForm}>
                        <Form.Item
                            label="Requirement"
                            name="requirement_id"
                            rules={[{ required: true, message: 'Select a requirement.' }]}
                        >
                            <Select
                                showSearch
                                placeholder="Select a requirement"
                                optionFilterProp="label"
                                options={(allRequirements?.data || []).map((item) => ({
                                    value: item.id,
                                    label: `${item.requirement}${item.agency?.name ? ` • ${item.agency.name}` : ''}`,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item label="Deadline">
                            <div>{selectedDate ? dayjs(selectedDate).format('MMMM D, YYYY') : 'Select a date'}</div>
                        </Form.Item>
                        <Text type="secondary">
                            Deadline will be set to the selected date on the calendar.
                        </Text>
                    </Form>
                </Modal>
            ) : null}

            <Row gutter={[16, 16]} className="dashboard-row">
                <Col xs={24}>
                    <Card title={<Space><BarChartOutlined /> Compliance by Agency</Space>} loading={agencyLoading} variant="outlined">
                        <div className="dashboard-status-legend">
                            {statusLegend.map((item) => (
                                <div key={item.key} className="dashboard-status-legend-item">
                                    <span className={`dashboard-status-swatch ${item.className}`} />
                                    <Text type="secondary">{item.label}</Text>
                                </div>
                            ))}
                        </div>
                        {(agencyStats || []).length ? (
                            <div className="dashboard-agency-columns">
                                {(agencyStats || []).map((agency) => {
                                    const total = agency.total || 0;
                                    const segments = [
                                        { key: 'pending', value: agency.pending, className: 'status-pending' },
                                        { key: 'complied', value: agency.complied, className: 'status-complied' },
                                        { key: 'na', value: agency.na, className: 'status-na' },
                                        { key: 'overdue', value: agency.overdue, className: 'status-overdue' },
                                    ];
                                    return (
                                        <div key={agency.agency} className="dashboard-agency-column">
                                            <div className="dashboard-agency-stack">
                                                {segments.map((segment) => {
                                                    const percent = total > 0 ? (segment.value / total) * 100 : 0;
                                                    return (
                                                        <div
                                                            key={segment.key}
                                                            className={`dashboard-agency-segment ${segment.className}`}
                                                            style={{ height: `${percent}%` }}
                                                            title={`${segment.key}: ${segment.value}`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            <div className="dashboard-agency-column-label">
                                                <Text
                                                    strong
                                                    className={`dashboard-agency-name ${String(agency.agency || '').length > 5 ? 'dashboard-agency-label--small' : ''}`}
                                                >
                                                    {agency.agency}
                                                </Text>
                                                <Text type="secondary">{total}</Text>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <Empty description="No agency data" />
                        )}
                    </Card>
                </Col>
            </Row>

            {!isPic ? (
                <Row gutter={[16, 16]} className="dashboard-row">
                    <Col xs={24}>
                        <Card
                            title="Regulatory Requirements"
                            loading={licenseLoading || permitLoading || certificationLoading}
                            variant="outlined"
                        >
                            {combinedRequirements.length ? (
                                <List
                                    dataSource={combinedRequirements}
                                    renderItem={(item: any) => (
                                        <List.Item
                                            className="dashboard-req-item"
                                            actions={[
                                                <Button
                                                    key="view"
                                                    type="link"
                                                    icon={<EyeOutlined />}
                                                    onClick={() => handleOpenDetail(item.id)}
                                                >
                                                    View latest submission
                                                </Button>,
                                            ]}
                                        >
                                        <List.Item.Meta
                                            title={item.requirement}
                                            description={(
                                                <Space wrap>
                                                    <Tag color="blue">{item.category}</Tag>
                                                    <Text type="secondary">{item.agency?.name || item.agency_id}</Text>
                                                    <Tag className={`dashboard-status-tag ${statusLegend.find(s => s.key === normalizeStatus(item.compliance_status))?.className || 'status-na'}`}>
                                                        {normalizeStatus(item.compliance_status).toUpperCase()}
                                                    </Tag>
                                                </Space>
                                            )}
                                        />
                                    </List.Item>
                                )}
                            />
                            ) : (
                                <Empty description="No license/permit requirements" />
                            )}
                        </Card>
                    </Col>
                </Row>
            ) : null}
            <Modal
                title="Latest Submission"
                open={detailOpen}
                onCancel={() => setDetailOpen(false)}
                footer={null}
                destroyOnClose
            >
                {detailLoading ? (
                    <div className="dashboard-modal-loading">Loading...</div>
                ) : latestSubmission ? (
                    <div className="dashboard-latest-upload">
                        <div><Text strong>Requirement:</Text> {requirementDetail?.requirement}</div>
                        <div><Text strong>Submission ID:</Text> {latestSubmission.submission_id}</div>
                        <div><Text strong>Uploaded By:</Text> {latestSubmission.uploader?.employee_name || latestSubmission.uploader_email || 'Unknown'}</div>
                        {(() => {
                            const uploadedFor = latestSubmission.assignment?.user?.employee_name;
                            const assignedUserId = latestSubmission.assignment?.assigned_to_user_id;
                            const showUploadedFor = Boolean(
                                uploadedFor
                                && assignedUserId
                                && assignedUserId !== latestSubmission.uploaded_by_user_id
                            );
                            if (!showUploadedFor) {
                                return null;
                            }
                            return <div><Text strong>Uploaded For:</Text> {uploadedFor}</div>;
                        })()}
                        <div><Text strong>Uploaded At:</Text> {latestSubmission.upload_date ? new Date(latestSubmission.upload_date).toLocaleString() : 'N/A'}</div>
                        <div><Text strong>Status:</Text> {latestSubmission.approval_status}</div>
                        {(() => {
                            const isAssignedToRequirement = Boolean(
                                requirementDetail?.assignments?.some((assignment) =>
                                    assignment.assigned_to_user_id === currentUserId
                                )
                            );
                            const canViewSubmissionFiles = Boolean(
                                isAdmin
                                || latestSubmission.uploaded_by_user_id === currentUserId
                                || (latestSubmission.approval_status === 'APPROVED' && isAssignedToRequirement)
                            );
                            if (!canViewSubmissionFiles) {
                                return null;
                            }
                            return (
                                <div className="dashboard-latest-upload-actions">
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            const fileId = latestSubmission.files?.[0]?.id;
                                            if (fileId) {
                                                handleViewFile(latestSubmission.id, fileId);
                                            }
                                        }}
                                    >
                                        Open file
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <Empty description="No submissions found" />
                )}
            </Modal>
        </div>
    );
};

export default Dashboard;
