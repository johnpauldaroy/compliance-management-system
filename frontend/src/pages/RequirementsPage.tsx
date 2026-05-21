import { Table, Button, Tag, Drawer, Form, Input, Select, Space, message, Typography, Row, Col, Upload, Tooltip, Descriptions, Modal, Collapse, DatePicker, Switch, Empty } from 'antd';
import { PlusOutlined, InfoCircleOutlined, EditOutlined, UploadOutlined, ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined, EyeOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import type { SortOrder } from 'antd/es/table/interface';
import { useLocation } from 'react-router-dom';
import { agencyService, branchUnitDepartmentService, positionService, requirementService, uploadService, userService } from '../services/apiService';
import { authService } from '../services/authService';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Agency, BranchUnitDepartment, PaginatedResponse, Position, Requirement, RequirementAssignment, Upload as UploadFileRecord, UploadSubmission, User } from '../types';
import './RequirementsPage.css';

const { Text } = Typography;

const formatPhDate = (value?: string | null) => {
    if (!value) {
        return 'N/A';
    }
    const date = value.includes('T')
        ? new Date(value)
        : new Date(`${value}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
};

const toPhDateKey = (value?: string | null) => {
    if (!value) {
        return '';
    }
    const date = value.includes('T')
        ? new Date(value)
        : new Date(`${value}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
};

const toDeadlineDayjs = (value?: string | null) => {
    if (!value) {
        return null;
    }
    const raw = value.includes('T') ? value : `${value}T00:00:00+08:00`;
    const parsed = dayjs(raw);
    if (parsed.isValid()) {
        return parsed;
    }
    const fallbackKey = toPhDateKey(value);
    if (!fallbackKey) {
        return null;
    }
    const fallback = dayjs(fallbackKey);
    return fallback.isValid() ? fallback : null;
};

const allowedUploadExtensions = ['.pdf', '.csv', '.xls', '.xlsx'];
const maxUploadSizeBytes = 250 * 1024 * 1024;
const uploadAccept = '.pdf,.csv,.xls,.xlsx,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const isInlineViewableFile = (file?: { original_file_name?: string | null; doc_file?: string | null } | null) => {
    const name = (file?.original_file_name || file?.doc_file || '').toLowerCase();
    return name.endsWith('.pdf');
};
const triggerFileDownload = (blob: Blob, fileName: string) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
};

const toIdList = (value?: string | null) =>
    value
        ? value.split(';').map((item) => Number(item.trim())).filter(Boolean)
        : [];

const buildSequentialDeadlineRows = (
    picIds: number[],
    existingRows: SequentialDeadlineRow[] = [],
    fallbackDeadline?: string | null
) => {
    const existingMap = new Map(
        existingRows
            .filter((row) => row?.assigned_to_user_id)
            .map((row) => [row.assigned_to_user_id, row.deadline || ''])
    );

    return picIds.map((id, index) => ({
        assigned_to_user_id: id,
        deadline: existingMap.get(id) ?? (index === picIds.length - 1 ? (fallbackDeadline || '') : ''),
    }));
};

const getPositionNames = (ids?: string | null, positions?: Position[]) => {
    const list = toIdList(ids);
    if (!list.length) {
        return '';
    }
    const map = new Map((positions || []).map((position) => [position.id, position.name]));
    return list.map((id) => map.get(id)).filter(Boolean).join('; ');
};

const getBranchUnitNames = (ids?: string | null, units?: BranchUnitDepartment[]) => {
    const list = toIdList(ids);
    if (!list.length) {
        return '';
    }
    const map = new Map((units || []).map((unit) => [unit.id, unit.name]));
    return list.map((id) => map.get(id)).filter(Boolean).join('; ');
};

const getPersonInChargeNames = (ids?: string | null, users?: User[]) => {
    const list = toIdList(ids);
    if (!list.length) {
        return '';
    }
    const map = new Map((users || []).map((user) => [user.id, user.employee_name]));
    return list.map((id) => map.get(id)).filter(Boolean).join('; ');
};

type RequirementFormValues = {
    req_id?: string;
    agency_id: number;
    category: string;
    requirement: string;
    description?: string;
    position_ids: number[];
    branch_unit_department_ids: number[];
    person_in_charge_user_ids: number[];
    frequency: string;
    schedule: string;
    deadline?: string;
    auto_deadline_enabled?: boolean;
    assignment_mode?: 'parallel' | 'sequential';
    sequential_deadlines?: SequentialDeadlineRow[];
};

type SequentialDeadlineRow = {
    assigned_to_user_id: number;
    deadline?: string;
};

type RequirementPayload = {
    req_id?: string;
    agency_id: number;
    category: string;
    requirement: string;
    description?: string;
    position_ids?: string | null;
    branch_unit_department_ids?: string | null;
    person_in_charge_user_ids?: string | null;
    frequency: string;
    schedule: string;
    deadline?: string;
    auto_deadline_enabled?: boolean;
    assignment_mode?: 'parallel' | 'sequential';
    sequential_deadlines?: SequentialDeadlineRow[];
};

const RequirementsPage = () => {
    const location = useLocation();
    const [form] = Form.useForm<RequirementFormValues>();
    const [uploadForm] = Form.useForm();
    const [submittedDeadlineForm] = Form.useForm();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'na' | 'pending' | 'complied' | 'overdue'>('all');
    const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active');
    const [sortField, setSortField] = useState<'id' | 'req_id' | 'requirement'>('id');
    const [sortOrder, setSortOrder] = useState<SortOrder>('ascend');

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadRequirementId, setUploadRequirementId] = useState<number | null>(null);
    const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [filesModalOpen, setFilesModalOpen] = useState(false);
    const [activeFiles, setActiveFiles] = useState<UploadFileRecord[]>([]);
    const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);
    const [submittedDeadlineModalOpen, setSubmittedDeadlineModalOpen] = useState(false);
    const [editingSubmittedDeadline, setEditingSubmittedDeadline] = useState<UploadSubmission | null>(null);

    const isMonthlyFrequency = (value?: string | null) => (value || '').toLowerCase().includes('month');

    const statusFilterFromUrl = useMemo(() => {
        const rawStatus = new URLSearchParams(location.search).get('status')?.toLowerCase();
        if (rawStatus === 'compliant' || rawStatus === 'pending' || rawStatus === 'overdue' || rawStatus === 'na' || rawStatus === 'complied') {
            return rawStatus === 'compliant' ? 'complied' : rawStatus;
        }
        return undefined;
    }, [location.search]);

    useEffect(() => {
        if (statusFilterFromUrl) {
            setStatusFilter(statusFilterFromUrl as typeof statusFilter);
        }
    }, [statusFilterFromUrl]);

    const getComplianceDisplay = (status?: string) =>
        status ?? 'N/A';

    const { data: requirementsResponse, isLoading, isFetching, refetch, error: requirementsError } = useQuery<PaginatedResponse<Requirement>>({
        queryKey: ['requirements', currentPage, pageSize, searchTerm, statusFilter, activeFilter, sortField, sortOrder],
        queryFn: () => requirementService.getAll({
            page: currentPage,
            per_page: pageSize,
            search: searchTerm.trim() || undefined,
            status: statusFilter === 'all' ? undefined : statusFilter,
            active_status: activeFilter,
            sort_by: sortField,
            sort_dir: sortOrder === 'descend' ? 'desc' : 'asc',
        }),
        placeholderData: keepPreviousData,
    });

    const { data: agencies } = useQuery({
        queryKey: ['agencies', 'active'],
        queryFn: () => agencyService.getAll({ active_only: true }),
    });

    const { data: agenciesAll } = useQuery({
        queryKey: ['agencies', 'all'],
        queryFn: () => agencyService.getAll(),
        enabled: Boolean(editingRequirement),
    });

    const { data: branchUnits } = useQuery({
        queryKey: ['branch-unit-departments', 'active'],
        queryFn: () => branchUnitDepartmentService.getAll({ active_only: true }),
    });

    const { data: branchUnitsAll } = useQuery({
        queryKey: ['branch-unit-departments', 'all'],
        queryFn: () => branchUnitDepartmentService.getAll(),
        enabled: Boolean(editingRequirement),
    });

    const { data: positions } = useQuery({
        queryKey: ['positions', 'active'],
        queryFn: () => positionService.getAll({ active_only: true }),
    });

    const { data: positionsAll } = useQuery({
        queryKey: ['positions', 'all'],
        queryFn: () => positionService.getAll(),
        enabled: Boolean(editingRequirement),
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: userService.getAll,
    });

    const { data: detailResponse, isLoading: isDetailLoading, error: detailError, refetch: refetchDetails } = useQuery<Requirement>({
        queryKey: ['requirements-page-detail', detailId],
        queryFn: () => requirementService.show(detailId as number),
        enabled: Boolean(detailId),
    });

    const { data: meData } = useQuery<{ user: User }>({
        queryKey: ['me'],
        queryFn: () => authService.me(),
    });

    const currentUserId = meData?.user?.id;
    const detailData = useMemo<Requirement | undefined>(() => {
        if (!detailResponse && !selectedRequirement) {
            return undefined;
        }
        return {
            ...(selectedRequirement || {}),
            ...(detailResponse || {}),
        } as Requirement;
    }, [detailResponse, selectedRequirement]);

    const isAdmin = useMemo(() => {
        const roles = meData?.user?.roles || [];
        return roles.some((role: any) =>
            role?.name === 'Compliance & Admin Specialist' || role?.name === 'Super Admin'
        );
    }, [meData]);

    const handleViewUpload = async (submissionId: number, uploadId: number, file?: UploadFileRecord | null) => {
        try {
            const inline = isInlineViewableFile(file);
            if (inline) {
                const { url } = await uploadService.getSignedUrl(submissionId, uploadId, true);
                window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }

            const blob = await uploadService.download(submissionId, uploadId, false);
            triggerFileDownload(blob, getFileName(file));
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Failed to open file.');
        }
    };

    const getFileName = (file?: UploadFileRecord | null) => {
        const original = file?.original_file_name;
        if (original) {
            return original;
        }
        const path = file?.doc_file;
        if (!path) {
            return 'View file';
        }
        const parts = path.split('/');
        return parts[parts.length - 1] || 'View file';
    };

    const openFilesModal = (submissionId: number, files: UploadFileRecord[]) => {
        setActiveSubmissionId(submissionId);
        setActiveFiles(files || []);
        setFilesModalOpen(true);
    };

    const getOrderedAssignments = (assignments: RequirementAssignment[], isSequential: boolean) => {
        if (!isSequential) {
            return assignments;
        }
        return [...assignments].sort((a, b) => {
            const aOrder = a.sequence_order ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.sequence_order ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            return (a.id || 0) - (b.id || 0);
        });
    };

    const getActiveSequentialAssignment = (assignments: RequirementAssignment[]) =>
        assignments.find((assignment) => assignment.compliance_status !== 'APPROVED');

    const resolveAssignmentDeadlineValue = (
        assignments: RequirementAssignment[],
        assignmentId?: number | null,
        fallbackDeadline?: string | null
    ) => {
        const assignmentDeadline = assignmentId
            ? assignments.find((assignment) => assignment.id === assignmentId)?.deadline
            : undefined;
        return toDeadlineDayjs(assignmentDeadline || fallbackDeadline);
    };

    const syncSequentialDeadlines = (picIds: number[], fallbackDeadline?: string | null) => {
        const currentRows = form.getFieldValue('sequential_deadlines') || [];
        form.setFieldsValue({
            person_in_charge_user_ids: picIds,
            sequential_deadlines: buildSequentialDeadlineRows(picIds, currentRows, fallbackDeadline),
        });
    };

    const moveSequentialPic = (fromIndex: number, toIndex: number) => {
        const picIds: number[] = form.getFieldValue('person_in_charge_user_ids') || [];
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= picIds.length || toIndex >= picIds.length) {
            return;
        }

        const next = [...picIds];
        [next[toIndex], next[fromIndex]] = [next[fromIndex], next[toIndex]];
        syncSequentialDeadlines(next, form.getFieldValue('deadline'));
    };

    const createRequirement = useMutation({
        mutationFn: (payload: RequirementPayload) => requirementService.create(payload),
        onSuccess: () => {
            message.success('Requirement added.');
            setIsDrawerOpen(false);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to add requirement.');
        },
    });

    const updateRequirement = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Partial<RequirementPayload> }) =>
            requirementService.update(id, payload),
        onSuccess: () => {
            message.success('Requirement updated.');
            setIsDrawerOpen(false);
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update requirement.');
        },
    });

    const deactivateRequirement = useMutation({
        mutationFn: (id: number) => requirementService.deactivate(id),
        onSuccess: () => {
            message.success('Requirement deactivated.');
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to deactivate requirement.');
        },
    });

    const reactivateRequirement = useMutation({
        mutationFn: (id: number) => requirementService.reactivate(id),
        onSuccess: () => {
            message.success('Requirement reactivated.');
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to reactivate requirement.');
        },
    });

    const importRequirements = useMutation({
        mutationFn: requirementService.import,
        onSuccess: (response) => {
            const created = response?.created ?? 0;
            const errors = response?.errors ?? [];
            if (errors.length) {
                message.warning(`Imported ${created} rows, ${errors.length} failed.`);
            } else {
                message.success(`Imported ${created} rows.`);
            }
            refetch();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to import requirements.');
        },
    });

    const updateSubmittedDeadline = useMutation({
        mutationFn: ({ id, deadline_at_upload }: { id: number; deadline_at_upload: string | null }) =>
            uploadService.updateSubmittedDeadline(id, { deadline_at_upload }),
        onSuccess: () => {
            message.success('Submitted deadline updated.');
            setSubmittedDeadlineModalOpen(false);
            setEditingSubmittedDeadline(null);
            submittedDeadlineForm.resetFields();
            refetchDetails();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Failed to update submitted deadline.');
        },
    });

    const handleAdd = () => {
        setEditingRequirement(null);
        form.resetFields();
        form.setFieldsValue({
            req_id: 'Select agency',
            assignment_mode: 'parallel',
            sequential_deadlines: [],
        });
        setIsDrawerOpen(true);
    };

    const openSubmittedDeadlineModal = (submission: UploadSubmission) => {
        submittedDeadlineForm.resetFields();
        setEditingSubmittedDeadline(submission);
        submittedDeadlineForm.setFieldsValue({
            deadline_at_upload: toDeadlineDayjs(submission.deadline_at_upload) || undefined,
        });
        setSubmittedDeadlineModalOpen(true);
    };

    const handleEdit = (record: Requirement) => {
        const selectedPicIds = toIdList(record.person_in_charge_user_ids);
        const assignmentPicIds = (record.assignments || [])
            .map((assignment) => assignment.assigned_to_user_id)
            .filter(Boolean);
        const orderedAssignmentPicIds = (record.assignments || [])
            .slice()
            .sort((a, b) => {
                const aOrder = a.sequence_order ?? Number.MAX_SAFE_INTEGER;
                const bOrder = b.sequence_order ?? Number.MAX_SAFE_INTEGER;
                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }
                return (a.id || 0) - (b.id || 0);
            })
            .map((assignment) => assignment.assigned_to_user_id)
            .filter(Boolean);
        const resolvedPicIds = selectedPicIds.length
            ? selectedPicIds
            : Array.from(new Set(assignmentPicIds));
        const assignmentMode = record.assignment_mode ?? 'parallel';
        const resolvedOrderedPicIds = assignmentMode === 'sequential' && orderedAssignmentPicIds.length
            ? orderedAssignmentPicIds
            : resolvedPicIds;
        const sequentialDeadlineRows = buildSequentialDeadlineRows(
            resolvedOrderedPicIds,
            getOrderedAssignments(record.assignments || [], true).map((assignment) => ({
                assigned_to_user_id: assignment.assigned_to_user_id,
                deadline: assignment.deadline ? toPhDateKey(assignment.deadline) : '',
            })),
            record.deadline ? toPhDateKey(record.deadline) : ''
        );

        setEditingRequirement(record);
        form.setFieldsValue({
            req_id: record.req_id,
            agency_id: record.agency_id,
            category: record.category,
            requirement: record.requirement,
            description: record.description || '',
            position_ids: toIdList(record.position_ids),
            branch_unit_department_ids: toIdList(record.branch_unit_department_ids),
            person_in_charge_user_ids: resolvedOrderedPicIds,
            frequency: record.frequency,
            schedule: record.schedule,
            deadline: record.deadline ? toPhDateKey(record.deadline) : '',
            auto_deadline_enabled: record.auto_deadline_enabled ?? false,
            assignment_mode: assignmentMode,
            sequential_deadlines: sequentialDeadlineRows,
        });
        setIsDrawerOpen(true);
    };

    const handleSubmit = (values: RequirementFormValues) => {
        const assignmentMode = values.assignment_mode || 'parallel';
        const payload: RequirementPayload = {
            ...values,
            position_ids: values.position_ids.length ? values.position_ids.join(';') : null,
            branch_unit_department_ids: values.branch_unit_department_ids.length ? values.branch_unit_department_ids.join(';') : null,
            person_in_charge_user_ids: values.person_in_charge_user_ids.length ? values.person_in_charge_user_ids.join(';') : null,
            sequential_deadlines: assignmentMode === 'sequential'
                ? buildSequentialDeadlineRows(values.person_in_charge_user_ids, values.sequential_deadlines || [], values.deadline)
                : undefined,
            deadline: assignmentMode === 'parallel'
                ? values.deadline
                : undefined,
        };
        if (editingRequirement) {
            updateRequirement.mutate({ id: editingRequirement.id, payload });
            return;
        }
        createRequirement.mutate(payload);
    };

    const handleDeactivate = (record: Requirement) => {
        Modal.confirm({
            title: `Deactivate ${record.req_id}?`,
            content: 'This will stop uploads, reminders, deadline notifications, and dashboard activity for this requirement.',
            okText: 'Deactivate',
            okType: 'danger',
            onOk: () => deactivateRequirement.mutate(record.id),
        });
    };

    const handleReactivate = (record: Requirement) => {
        Modal.confirm({
            title: `Reactivate ${record.req_id}?`,
            content: 'This will make the requirement operational again. Reactivation does not send assignment emails.',
            okText: 'Reactivate',
            onOk: () => reactivateRequirement.mutate(record.id),
        });
    };

    const columns: ColumnsType<Requirement> = [
        {
            title: 'Req ID',
            dataIndex: 'req_id',
            key: 'req_id',
            width: 120,
            render: (value) => <div className="requirements-cell-wrap">{value}</div>,
            sorter: true,
            sortOrder: sortField === 'req_id' ? sortOrder : undefined,
        },
        {
            title: 'Requirement Name',
            dataIndex: 'requirement',
            key: 'requirement',
            width: 260,
            render: (text) => <span className="requirements-cell-name">{text}</span>,
            sorter: true,
            sortOrder: sortField === 'requirement' ? sortOrder : undefined,
        },
        {
            title: 'Frequency',
            dataIndex: 'frequency',
            key: 'frequency',
            render: (freq) => (
                <div className="requirements-cell-wrap">
                    <Tag color="blue" className="requirements-tag">
                        {freq}
                    </Tag>
                </div>
            ),
            width: 140,
        },
        {
            title: 'Compliance Status',
            dataIndex: 'compliance_status',
            key: 'compliance_status',
            render: (_, record) => (
                <div className="requirements-cell-wrap">
                    {getComplianceDisplay(record.compliance_status)}
                </div>
            ),
            width: 160,
        },
        {
            title: 'State',
            key: 'active_state',
            width: 110,
            render: (_, record) => (
                <Tag color={record.is_active === false ? 'default' : 'success'}>
                    {record.is_active === false ? 'Inactive' : 'Active'}
                </Tag>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 230,
            render: (_, record) => (
                <Space wrap>
                    <Tooltip title="Details">
                        <Button
                            type="text"
                            icon={<InfoCircleOutlined />}
                            className="requirements-action requirements-action--info"
                            onClick={() => {
                                setSelectedRequirement(record);
                                setDetailId(record.id);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            className="requirements-action requirements-action--warning"
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    {record.is_active === false ? (
                        <Tooltip title="Reactivate">
                            <Button
                                type="text"
                                icon={<CheckCircleOutlined />}
                                className="requirements-action requirements-action--info"
                                onClick={() => handleReactivate(record)}
                            />
                        </Tooltip>
                    ) : (
                        <Tooltip title="Deactivate">
                            <Button
                                type="text"
                                danger
                                icon={<StopOutlined />}
                                className="requirements-action requirements-action--danger"
                                onClick={() => handleDeactivate(record)}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    useEffect(() => {
        if (!requirementsError) {
            return;
        }
        const error = requirementsError as any;
        message.error(error.response?.data?.message || 'Failed to load requirements.');
    }, [requirementsError]);

    useEffect(() => {
        if (!detailError || !detailId) {
            return;
        }
        if (detailData || selectedRequirement) {
            return;
        }
        const error = detailError as any;
        message.error(error.response?.data?.message || 'Failed to load requirement details.');
    }, [detailError, detailId, detailData, selectedRequirement]);

    const requirements = useMemo<Requirement[]>(() => requirementsResponse?.data ?? [], [requirementsResponse]);

    const agencyOptions = useMemo(() => {
        const list = editingRequirement ? (agenciesAll || agencies || []) : (agencies || []);
        return list.map((agency: Agency) => ({
            value: agency.id,
            label: `${agency.agency_id} - ${agency.name}${agency.is_active === false ? ' (Inactive)' : ''}`,
        }));
    }, [agencies, agenciesAll, editingRequirement]);

    const positionOptions = useMemo(() => {
        const list = editingRequirement ? (positionsAll || positions || []) : (positions || []);
        return list.map((position: Position) => ({
            value: position.id,
            label: `${position.name}${position.is_active === false ? ' (Inactive)' : ''}`,
        }));
    }, [positions, positionsAll, editingRequirement]);

    const branchUnitOptions = useMemo(() => {
        const list = editingRequirement ? (branchUnitsAll || branchUnits || []) : (branchUnits || []);
        return list.map((unit: BranchUnitDepartment) => ({
            value: unit.id,
            label: `${unit.name}${unit.is_active === false ? ' (Inactive)' : ''}`,
        }));
    }, [branchUnits, branchUnitsAll, editingRequirement]);

    const picUsers = useMemo(() => {
        const users: User[] = usersData?.data || [];
        return users.filter((user) => {
            const roleName = user.roles?.[0]?.name || '';
            return (
                roleName === 'Person-In-Charge (PIC)' ||
                roleName === 'Compliance & Admin Specialist' ||
                roleName === 'Person-in-Charge'
            );
        });
    }, [usersData]);

    const picLabelMap = useMemo(() => {
        return new Map(
            picUsers.map((user) => [
                user.id,
                `${user.employee_name} (${user.user_id})`,
            ])
        );
    }, [picUsers]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, activeFilter]);

    return (
        <div className="requirements-page">
            <div className="requirements-header">
                <Typography.Title level={2} className="requirements-title">Requirements</Typography.Title>
            </div>
            <div className="requirements-toolbar">
                <Input
                    placeholder="Search requirements"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    allowClear
                    className="requirements-search"
                />
                <Select
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value)}
                    options={[
                        { label: 'All statuses', value: 'all' },
                        { label: 'N/A', value: 'na' },
                        { label: 'Pending', value: 'pending' },
                        { label: 'Complied', value: 'complied' },
                        { label: 'Overdue', value: 'overdue' },
                    ]}
                    className="requirements-filter"
                />
                <Select
                    value={activeFilter}
                    onChange={(value) => setActiveFilter(value)}
                    options={[
                        { label: 'Active', value: 'active' },
                        { label: 'Inactive', value: 'inactive' },
                        { label: 'All states', value: 'all' },
                    ]}
                    className="requirements-filter"
                />
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={isFetching}
                        onClick={async () => {
                            const key = 'requirements-refresh';
                            message.loading({ content: 'Data is refreshing...', key });
                            await refetch();
                            message.success({ content: 'Data is up to date.', key, duration: 2 });
                        }}
                    />
                </Space>
                <div className="requirements-toolbar-right">
                    <Space>
                        <Upload
                            accept=".csv"
                            showUploadList={false}
                            beforeUpload={(file) => {
                                importRequirements.mutate(file);
                                return false;
                            }}
                        >
                            <Button icon={<UploadOutlined />}>Import</Button>
                        </Upload>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Add Requirement
                        </Button>
                    </Space>
                </div>
            </div>
            <Table
                columns={columns}
                dataSource={requirements}
                rowKey="id"
                loading={isLoading}
                tableLayout="fixed"
                onChange={(_, __, sorter) => {
                    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
                    if (!nextSorter?.order) {
                        setSortField('id');
                        setSortOrder('ascend');
                        return;
                    }
                    if (nextSorter.columnKey === 'requirement') {
                        setSortField('requirement');
                    } else if (nextSorter.columnKey === 'req_id') {
                        setSortField('req_id');
                    } else {
                        setSortField('id');
                    }
                    setSortOrder(nextSorter.order);
                }}
                pagination={{
                    current: currentPage,
                    pageSize,
                    total: requirementsResponse?.total || 0,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '25', '50', '100'],
                    onChange: (page, size) => {
                        setCurrentPage(page);
                        if (size && size !== pageSize) {
                            setPageSize(size);
                        }
                    },
                }}
            />
            <Drawer
                title={editingRequirement ? 'Edit Requirement' : 'Add Requirement'}
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                destroyOnClose
                width={840}
                className="requirements-drawer"
                footer={(
                    <div className="requirements-drawer-footer">
                        <Space>
                            <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
                            <Button
                                type="primary"
                                onClick={() => form.submit()}
                                loading={createRequirement.isPending || updateRequirement.isPending}
                            >
                                {editingRequirement ? 'Save Changes' : 'Create Requirement'}
                            </Button>
                        </Space>
                    </div>
                )}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={(changed) => {
                        if (Object.prototype.hasOwnProperty.call(changed, 'frequency')) {
                            const nextFrequency = changed.frequency;
                            if (!isMonthlyFrequency(nextFrequency)) {
                                form.setFieldsValue({ auto_deadline_enabled: false });
                            }
                        }
                        if (Object.prototype.hasOwnProperty.call(changed, 'assignment_mode')) {
                            const nextMode = changed.assignment_mode || 'parallel';
                            if (nextMode === 'sequential') {
                                const picIds = form.getFieldValue('person_in_charge_user_ids') || [];
                                syncSequentialDeadlines(picIds, form.getFieldValue('deadline'));
                            }
                        }
                    }}
                    onFinish={handleSubmit}
                >
                    <Row gutter={12}>
                        <Col span={4}>
                            <Form.Item
                                label="Requirement ID"
                                name="req_id"
                            >
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={16}>
                            <Form.Item
                                label="Agency"
                                name="agency_id"
                                rules={[{ required: true, message: 'Agency is required.' }]}
                            >
                                <Select
                                    options={agencyOptions}
                                    showSearch
                                    optionFilterProp="label"
                                    onChange={(value) => {
                                        if (!editingRequirement) {
                                            const agency = (agencies || []).find((item: Agency) => item.id === value);
                                            if (agency) {
                                                const max = (requirements || [])
                                                    .filter((req) => req.agency_id === value)
                                                    .map((req: Requirement) => {
                                                        const match = req.req_id?.match(/-(\d{3,})$/);
                                                        return match ? parseInt(match[1], 10) : 0;
                                                    })
                                                    .reduce((acc: number, num: number) => Math.max(acc, num), 0);
                                                const next = String(max + 1).padStart(3, '0');
                                                form.setFieldsValue({ req_id: `${agency.agency_id}-${next}`.toUpperCase() });
                                            }
                                        }
                                    }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item
                                label="Category"
                                name="category"
                                rules={[{ required: true, message: 'Category is required.' }]}
                            >
                                <Select
                                    options={[
                                        'Permit',
                                        'Meeting',
                                        'Report',
                                        'Certification',
                                        'Policy',
                                        'Plan',
                                        'Dues',
                                        'Contract',
                                        'Chart',
                                        'License',
                                    ].map((category) => ({ label: category, value: category }))}
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) =>
                                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item
                        label="Requirement Name"
                        name="requirement"
                        rules={[{ required: true, message: 'Requirement name is required.' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item label="Description" name="description">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item
                                label="Assigned To"
                                name="position_ids"
                                rules={[{ required: true, message: 'Assigned to is required.' }]}
                            >
                                <Select
                                    mode="multiple"
                                    maxTagCount="responsive"
                                    options={positionOptions}
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Select position(s)"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Branch/Unit/Department In Charge"
                                name="branch_unit_department_ids"
                                rules={[{ required: true, message: 'Branch/unit/department is required.' }]}
                            >
                                <Select
                                    mode="multiple"
                                    maxTagCount="responsive"
                                    options={branchUnitOptions}
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Select branch/unit/department(s)"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item
                        label="Assignment Mode"
                        name="assignment_mode"
                        rules={[{ required: true, message: 'Assignment mode is required.' }]}
                        initialValue="parallel"
                    >
                        <Select
                            options={[
                                { label: 'Parallel', value: 'parallel' },
                                { label: 'Sequential', value: 'sequential' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item label="Person-In-Charge" name="person_in_charge_user_ids">
                        <Select
                            mode="multiple"
                            maxTagCount="responsive"
                            options={picUsers.map((user) => ({
                                value: user.id,
                                label: `${user.employee_name} (${user.user_id})`,
                            }))}
                            showSearch
                            optionFilterProp="label"
                            placeholder="Select person-in-charge"
                            onChange={(nextPicIds: number[]) => {
                                const assignmentMode = form.getFieldValue('assignment_mode') || 'parallel';
                                if (assignmentMode === 'sequential') {
                                    syncSequentialDeadlines(nextPicIds, form.getFieldValue('deadline'));
                                    return;
                                }
                                form.setFieldsValue({ person_in_charge_user_ids: nextPicIds });
                            }}
                        />
                    </Form.Item>
                    <Form.Item shouldUpdate>
                        {() => {
                            const mode = form.getFieldValue('assignment_mode') || 'parallel';
                            const picIds: number[] = form.getFieldValue('person_in_charge_user_ids') || [];
                            const sequentialDeadlines: SequentialDeadlineRow[] = form.getFieldValue('sequential_deadlines') || [];
                            if (mode !== 'sequential' || !picIds.length) {
                                return null;
                            }
                            const finalDeadline = sequentialDeadlines[picIds.length - 1]?.deadline || '';
                            return (
                                <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                                    <Typography.Text type="secondary">
                                        Arrange the PIC order and set each PIC deadline. The last PIC deadline becomes the final requirement deadline.
                                    </Typography.Text>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                        {picIds.map((id, index) => (
                                            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                                <div style={{ flex: 1 }}>
                                                    <Text>
                                                        {index + 1}. {picLabelMap.get(id) || `User #${id}`}
                                                    </Text>
                                                    <Form.Item
                                                        name={['sequential_deadlines', index, 'deadline']}
                                                        rules={[{ required: true, message: 'Set a deadline.' }]}
                                                        style={{ marginTop: 8, marginBottom: 0 }}
                                                    >
                                                        <Input type="date" />
                                                    </Form.Item>
                                                    <Form.Item
                                                        name={['sequential_deadlines', index, 'assigned_to_user_id']}
                                                        hidden
                                                    >
                                                        <Input type="hidden" />
                                                    </Form.Item>
                                                </div>
                                                <Space direction="vertical">
                                                    <Button
                                                        size="small"
                                                        icon={<ArrowUpOutlined />}
                                                        disabled={index === 0}
                                                        onClick={() => moveSequentialPic(index, index - 1)}
                                                    />
                                                    <Button
                                                        size="small"
                                                        icon={<ArrowDownOutlined />}
                                                        disabled={index === picIds.length - 1}
                                                        onClick={() => moveSequentialPic(index, index + 1)}
                                                    />
                                                </Space>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: 12 }}>
                                        <Typography.Text strong>Final Deadline: </Typography.Text>
                                        <Typography.Text>{finalDeadline ? formatPhDate(finalDeadline) : 'Set the last PIC deadline.'}</Typography.Text>
                                    </div>
                                </div>
                            );
                        }}
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item
                                label="Frequency"
                                name="frequency"
                                rules={[{ required: true, message: 'Frequency is required.' }]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Schedule"
                                name="schedule"
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item shouldUpdate>
                        {() => {
                            const assignmentMode = form.getFieldValue('assignment_mode') || 'parallel';
                            if (assignmentMode !== 'parallel') {
                                return null;
                            }

                            return (
                                <Form.Item label="Deadline" name="deadline">
                                    <Input type="date" />
                                </Form.Item>
                            );
                        }}
                    </Form.Item>
                    <Form.Item shouldUpdate>
                        {() => {
                            const frequency = form.getFieldValue('frequency');
                            const assignmentMode = form.getFieldValue('assignment_mode') || 'parallel';
                            const isMonthly = isMonthlyFrequency(frequency);
                            if (!isMonthly) {
                                return null;
                            }
                            const helperText = assignmentMode === 'parallel'
                                ? 'Each approved PIC auto-advances independently.'
                                : 'All PICs must be approved before the deadline advances.';
                            return (
                                <Form.Item
                                    label="Auto-advance monthly deadline"
                                    tooltip="When frequency is monthly, automatically move the deadline to next month after approval."
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <Form.Item name="auto_deadline_enabled" valuePropName="checked" noStyle>
                                            <Switch />
                                        </Form.Item>
                                        <Typography.Text type="secondary">{helperText}</Typography.Text>
                                    </div>
                                </Form.Item>
                            );
                        }}
                    </Form.Item>
                </Form>
            </Drawer>
            <Drawer
                title="Requirement Details"
                open={Boolean(detailId)}
                onClose={() => {
                    setDetailId(null);
                    setSelectedRequirement(null);
                }}
                width={840}
                className="requirements-drawer"
                destroyOnClose
            >
                {isDetailLoading ? (
                    <Text type="secondary">Loading...</Text>
                ) : !detailData ? (
                    <Text type="secondary">No details found.</Text>
                ) : (
                    <>
                        <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="Requirement ID">
                                {detailData?.req_id || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Agency">
                                {detailData?.agency?.name || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Category">
                                {detailData?.category || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Requirement Name" span={2}>
                                {detailData?.requirement || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Description" span={2}>
                                {detailData?.description || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Assigned To">
                                {getPositionNames(detailData?.position_ids, positionsAll || positions) || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Branch/Unit/Department In Charge">
                                {getBranchUnitNames(detailData?.branch_unit_department_ids, branchUnitsAll || branchUnits) || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Assignment Mode">
                                {detailData?.assignment_mode ? detailData.assignment_mode.toUpperCase() : 'PARALLEL'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Person-In-Charge" span={2}>
                                {detailData?.assignments && detailData.assignments.length > 0 ? (
                                    <div className="requirements-assignments-list">
                                        {(() => {
                                            const assignments = detailData.assignments || [];
                                            const isSequential = detailData.assignment_mode === 'sequential';
                                            const orderedAssignments = isSequential
                                                ? [...assignments].sort((a, b) => {
                                                    const aOrder = a.sequence_order ?? Number.MAX_SAFE_INTEGER;
                                                    const bOrder = b.sequence_order ?? Number.MAX_SAFE_INTEGER;
                                                    if (aOrder !== bOrder) {
                                                        return aOrder - bOrder;
                                                    }
                                                    return (a.id || 0) - (b.id || 0);
                                                })
                                                : assignments;
                                            const activeAssignmentId = isSequential
                                                ? orderedAssignments.find((assignment) =>
                                                    assignment.compliance_status !== 'APPROVED'
                                                )?.id
                                                : null;

                                            return orderedAssignments.map((asgn, index) => (
                                                <div key={asgn.id} className="requirements-assignment-item">
                                                    <div className="requirements-assignment-header">
                                                        <Text strong className="requirements-assignment-name">
                                                            {isSequential ? `${index + 1}. ` : ''}{asgn.user?.employee_name || 'N/A'}
                                                        </Text>
                                                        <div className="requirements-assignment-tags">
                                                            {isSequential && activeAssignmentId === asgn.id ? (
                                                                <Tag color="gold">ACTIVE</Tag>
                                                            ) : null}
                                                            <Tag color={
                                                                asgn.compliance_status === 'APPROVED' ? 'green' :
                                                                    asgn.compliance_status === 'REJECTED' ? 'red' :
                                                                        asgn.compliance_status === 'SUBMITTED' ? 'blue' :
                                                                            asgn.compliance_status === 'OVERDUE' ? 'orange' : 'default'
                                                            }>
                                                                {asgn.compliance_status}
                                                            </Tag>
                                                        </div>
                                                    </div>
                                                    <div className="requirements-assignment-meta">
                                                        <span className="requirements-assignment-meta-item">
                                                            <span className="requirements-assignment-meta-label">Deadline</span>
                                                            <span className="requirements-assignment-meta-value">{formatPhDate(asgn.deadline)}</span>
                                                        </span>
                                                        <span className="requirements-assignment-meta-item">
                                                            <span className="requirements-assignment-meta-label">Submitted</span>
                                                            <span className="requirements-assignment-meta-value">
                                                                {asgn.last_submitted_at
                                                                    ? new Date(asgn.last_submitted_at).toLocaleDateString()
                                                                    : 'N/A'}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                ) : (
                                    getPersonInChargeNames(detailData?.person_in_charge_user_ids, picUsers) || 'N/A'
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Frequency">
                                {detailData?.frequency || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Schedule">
                                {detailData?.schedule || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label={detailData?.assignment_mode === 'parallel' ? 'Base Deadline' : 'Final Deadline'}>
                                <Space direction="vertical" size={0}>
                                    <span>{formatPhDate(detailData?.deadline)}</span>
                                    {detailData?.assignment_mode === 'parallel' ? (
                                        <Typography.Text type="secondary">
                                            Live deadlines follow each PIC assignment.
                                        </Typography.Text>
                                    ) : (
                                        <Typography.Text type="secondary">
                                            The final deadline follows the last PIC in the sequence.
                                        </Typography.Text>
                                    )}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Auto-advance Monthly Deadline">
                                {isMonthlyFrequency(detailData?.frequency)
                                    ? (detailData?.auto_deadline_enabled ? 'Enabled' : 'Disabled')
                                    : 'Disabled'}
                            </Descriptions.Item>
                            <Descriptions.Item label="State">
                                <Tag color={detailData?.is_active === false ? 'default' : 'success'}>
                                    {detailData?.is_active === false ? 'Inactive' : 'Active'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Overall Compliance Status" span={2}>
                                <Tag color={
                                    detailData?.compliance_status?.includes('100%') ? 'green' :
                                        detailData?.compliance_status?.includes('Late') ? 'red' : 'blue'
                                }>
                                    {getComplianceDisplay(detailData?.compliance_status)}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>
                        <div style={{ marginTop: 24 }}>
                            <Typography.Title level={5}>Uploads</Typography.Title>
                            {isAdmin && detailData?.is_active !== false ? (
                                <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    onClick={() => {
                                        if (detailData?.id) {
                                            setUploadRequirementId(detailData.id);
                                        } else {
                                            setUploadRequirementId(null);
                                        }
                                        setUploadFiles([]);
                                        uploadForm.resetFields();
                                        const assignments = detailData?.assignments || [];
                                        const isSequential = detailData?.assignment_mode === 'sequential';
                                        const orderedAssignments = getOrderedAssignments(assignments, isSequential);
                                        const activeSequential = isSequential ? getActiveSequentialAssignment(orderedAssignments) : null;
                                        const autoAssignmentId = activeSequential?.id || (orderedAssignments.length === 1 ? orderedAssignments[0].id : null);
                                        const deadlineValue = resolveAssignmentDeadlineValue(
                                            orderedAssignments,
                                            autoAssignmentId,
                                            detailData?.deadline
                                        );
                                        if (deadlineValue) {
                                            uploadForm.setFieldsValue({ deadline_at_upload: deadlineValue });
                                        }
                                        if (autoAssignmentId) {
                                            uploadForm.setFieldsValue({ assignment_id: autoAssignmentId });
                                        }
                                        setUploadModalOpen(true);
                                    }}
                                    style={{ marginBottom: 12 }}
                                >
                                    Upload
                                </Button>
                            ) : null}
                            {detailData?.submissions && detailData.submissions.length > 0 ? (
                                (() => {
                                    const grouped = detailData.submissions.reduce<Record<string, UploadSubmission[]>>((acc, submission) => {
                                        const key = submission.deadline_at_upload ? toPhDateKey(submission.deadline_at_upload) : 'no-deadline';
                                        acc[key] = acc[key] || [];
                                        acc[key].push(submission);
                                        return acc;
                                    }, {});
                                    const items = Object.entries(grouped)
                                        .sort(([aKey], [bKey]) => {
                                            if (aKey === 'no-deadline') return 1;
                                            if (bKey === 'no-deadline') return -1;
                                            return bKey.localeCompare(aKey);
                                        })
                                        .map(([key, items]) => {
                                        const label = key === 'no-deadline'
                                            ? 'Deadline: No deadline'
                                            : `Deadline: ${formatPhDate(key)}`;
                                        return {
                                            key,
                                            label,
                                            children: (
                                                <Collapse
                                                    items={items.map((submission) => ({
                                                        key: String(submission.id),
                                                        label: `${submission.submission_id || `Submission #${submission.id}`} - ${submission.uploader?.employee_name || submission.uploader_email || submission.assignment?.user?.employee_name || 'Unknown'}`,
                                                        children: (
                                                            <div className="requirements-submission-card">
                                                                <div className="requirements-submission-grid">
                                                                    <div className="requirements-submission-item">
                                                                        <span className="requirements-submission-label">Uploaded by</span>
                                                                        <span className="requirements-submission-value">
                                                                            {submission.uploader?.employee_name || submission.uploader_email || submission.assignment?.user?.employee_name || 'Unknown'}
                                                                        </span>
                                                                    </div>
                                                                    {(() => {
                                                                        const uploadedFor = submission.assignment?.user?.employee_name;
                                                                        const assignedUserId = submission.assignment?.assigned_to_user_id;
                                                                        const showUploadedFor = Boolean(
                                                                            uploadedFor
                                                                            && assignedUserId
                                                                            && assignedUserId !== submission.uploaded_by_user_id
                                                                        );
                                                                        if (!showUploadedFor) {
                                                                            return null;
                                                                        }
                                                                        return (
                                                                            <div className="requirements-submission-item">
                                                                                <span className="requirements-submission-label">Uploaded for</span>
                                                                                <span className="requirements-submission-value">{uploadedFor}</span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                    <div className="requirements-submission-item">
                                                                        <span className="requirements-submission-label">Uploaded at</span>
                                                                        <span className="requirements-submission-value">
                                                                            {submission.upload_date ? new Date(submission.upload_date).toLocaleString() : 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    {submission.deadline_at_upload || isAdmin ? (
                                                                        <div className="requirements-submission-item">
                                                                            <span className="requirements-submission-label">Submitted for Deadline Set On</span>
                                                                            <span className="requirements-submission-value">
                                                                                <Space size={6} wrap>
                                                                                    <span>{submission.deadline_at_upload ? formatPhDate(submission.deadline_at_upload) : 'N/A'}</span>
                                                                                    {isAdmin ? (
                                                                                        <Tooltip title="Edit submitted deadline">
                                                                                            <Button
                                                                                                type="text"
                                                                                                size="small"
                                                                                                icon={<EditOutlined />}
                                                                                                aria-label="Edit submitted deadline"
                                                                                                onClick={() => openSubmittedDeadlineModal(submission)}
                                                                                            />
                                                                                        </Tooltip>
                                                                                    ) : null}
                                                                                </Space>
                                                                            </span>
                                                                        </div>
                                                                    ) : null}
                                                                    {submission.approval_status !== 'PENDING' ? (
                                                                        <div className="requirements-submission-item">
                                                                            <span className="requirements-submission-label">
                                                                                {submission.approval_status === 'APPROVED' ? 'Approved at' : 'Rejected at'}
                                                                            </span>
                                                                            <span className="requirements-submission-value">
                                                                                {submission.status_change_on ? new Date(submission.status_change_on).toLocaleString() : 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                                <div className="requirements-submission-actions">
                                                                    {submission.files?.length ? (() => {
                                                                        const isAssignedToRequirement = Boolean(
                                                                            detailData?.assignments?.some((assignment) =>
                                                                                assignment.assigned_to_user_id === currentUserId
                                                                            )
                                                                        );
                                                                        const canViewSubmissionFiles = Boolean(
                                                                            isAdmin
                                                                            || submission.uploaded_by_user_id === currentUserId
                                                                            || (submission.approval_status === 'APPROVED' && isAssignedToRequirement)
                                                                        );
                                                                        if (!canViewSubmissionFiles) {
                                                                            return null;
                                                                        }
                                                                        return (
                                                                            <Button
                                                                                size="small"
                                                                                className="view-files-btn"
                                                                                onClick={() => openFilesModal(submission.id, submission.files as UploadFileRecord[])}
                                                                            >
                                                                                View Files ({submission.files.length})
                                                                            </Button>
                                                                        );
                                                                    })() : null}
                                                                    <Tag color={submission.approval_status === 'APPROVED' ? 'success' : submission.approval_status === 'REJECTED' ? 'error' : 'processing'}>
                                                                        {submission.approval_status}
                                                                    </Tag>
                                                                </div>
                                                            </div>
                                                        ),
                                                    }))}
                                                />
                                            ),
                                        };
                                        });
                                    return <Collapse items={items} />;
                                })()
                            ) : (
                                <div style={{ textAlign: 'center', marginTop: 8 }}>
                                    <Text type="secondary">No uploads yet.</Text>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Drawer>
            <Modal
                title="Upload Requirement File"
                open={uploadModalOpen}
                onCancel={() => setUploadModalOpen(false)}
                onOk={() => uploadForm.submit()}
                okText="Submit"
                okButtonProps={{ disabled: isUploading }}
                confirmLoading={isUploading}
                destroyOnClose
            >
                <Form
                    form={uploadForm}
                    layout="vertical"
                    onFinish={(values) => {
                        if (!uploadRequirementId) {
                            message.error('No requirement selected.');
                            return;
                        }
                        if (!uploadFiles.length) {
                            message.error('Please select at least one file to upload.');
                            return;
                        }
                        const formData = new FormData();
                        formData.append('requirement_id', String(uploadRequirementId));
                        uploadFiles.forEach((file) => {
                            const rawFile = (file as any).originFileObj || file;
                            formData.append('doc_file[]', rawFile as File);
                        });
                        if (values.assignment_id) {
                            formData.append('assignment_id', String(values.assignment_id));
                        }
                        if (values.comments) {
                            formData.append('comments', values.comments);
                        }
                        if (values.deadline_at_upload) {
                            formData.append('deadline_at_upload', values.deadline_at_upload.format('YYYY-MM-DD'));
                        }
                        if (values.approval_status) {
                            formData.append('approval_status', values.approval_status);
                        }
                        if (values.admin_remarks) {
                            formData.append('admin_remarks', values.admin_remarks);
                        }
                        setIsUploading(true);
                        uploadService.upload(formData)
                            .then(() => {
                                message.success('File uploaded.');
                                setUploadModalOpen(false);
                                refetchDetails();
                            })
                            .catch((error: any) => {
                                message.error(error.response?.data?.message || 'Failed to upload file.');
                            })
                            .finally(() => {
                                setIsUploading(false);
                            });
                    }}
                >
                    <Form.Item label="Document File" required>
                        <Upload
                            accept={uploadAccept}
                            multiple
                            fileList={uploadFiles}
                            beforeUpload={(file) => {
                                const lowerName = file.name.toLowerCase();
                                const isAllowed = allowedUploadExtensions.some((extension) => lowerName.endsWith(extension));
                                if (!isAllowed) {
                                    message.error('Only PDF, CSV, XLS, and XLSX files are allowed.');
                                    return Upload.LIST_IGNORE;
                                }
                                if (file.size > maxUploadSizeBytes) {
                                    message.error('Each file must be 250MB or less.');
                                    return Upload.LIST_IGNORE;
                                }
                                return false;
                            }}
                            onChange={(info) => {
                                setUploadFiles(info.fileList.map((item) => ({ ...item, status: 'done' })));
                            }}
                            onRemove={(file) => {
                                setUploadFiles((prev) => prev.filter((item) => item.uid !== file.uid));
                            }}
                        >
                            <Button icon={<UploadOutlined />} disabled={isUploading}>Select File</Button>
                        </Upload>
                    </Form.Item>
                    {(() => {
                        const assignments = detailData?.assignments || [];
                        if (!assignments.length) {
                            return null;
                        }
                        const isSequential = detailData?.assignment_mode === 'sequential';
                        const orderedAssignments = getOrderedAssignments(assignments as RequirementAssignment[], isSequential);
                        const activeSequential = isSequential ? getActiveSequentialAssignment(orderedAssignments) : null;
                        const selectable = isSequential
                            ? (activeSequential ? [activeSequential] : [])
                            : orderedAssignments;
                        const requireSelection = selectable.length > 1;
                        return (
                            <Form.Item
                                label="Upload for PIC"
                                name="assignment_id"
                                rules={requireSelection ? [{ required: true, message: 'Select a PIC.' }] : []}
                            >
                                <Select
                                    options={selectable.map((assignment) => ({
                                        value: assignment.id,
                                        label: assignment.user?.employee_name || `PIC #${assignment.assigned_to_user_id}`,
                                    }))}
                                    placeholder={isSequential ? 'Active PIC only' : 'Select a PIC'}
                                    disabled={selectable.length === 1}
                                    onChange={(value) => {
                                        const deadlineValue = resolveAssignmentDeadlineValue(
                                            selectable as RequirementAssignment[],
                                            value,
                                            detailData?.deadline
                                        );
                                        uploadForm.setFieldsValue({
                                            deadline_at_upload: deadlineValue || undefined,
                                        });
                                    }}
                                />
                            </Form.Item>
                        );
                    })()}
                    <Form.Item label="Comments" name="comments">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item label="Approval Status" name="approval_status">
                        <Select
                            options={[
                                { value: 'PENDING', label: 'PENDING' },
                                { value: 'APPROVED', label: 'APPROVED' },
                                { value: 'REJECTED', label: 'REJECTED' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item label="Deadline for this upload" name="deadline_at_upload">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="Admin Remarks" name="admin_remarks">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="Edit Submitted Deadline"
                open={submittedDeadlineModalOpen}
                onCancel={() => {
                    setSubmittedDeadlineModalOpen(false);
                    setEditingSubmittedDeadline(null);
                    submittedDeadlineForm.resetFields();
                }}
                onOk={() => submittedDeadlineForm.submit()}
                okText="Save"
                confirmLoading={updateSubmittedDeadline.isPending}
                destroyOnClose
            >
                <Form
                    form={submittedDeadlineForm}
                    layout="vertical"
                    onFinish={(values) => {
                        if (!editingSubmittedDeadline) {
                            return;
                        }
                        updateSubmittedDeadline.mutate({
                            id: editingSubmittedDeadline.id,
                            deadline_at_upload: values.deadline_at_upload
                                ? values.deadline_at_upload.format('YYYY-MM-DD')
                                : null,
                        });
                    }}
                >
                    <Form.Item
                        label="Submitted for deadline"
                        name="deadline_at_upload"
                    >
                        <DatePicker
                            format="YYYY-MM-DD"
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="Uploaded Files"
                open={filesModalOpen}
                onCancel={() => setFilesModalOpen(false)}
                footer={null}
                destroyOnClose
            >
                {activeFiles.length ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {activeFiles.map((file) => (
                            <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{getFileName(file)}</span>
                                <Button
                                    size="small"
                                    className="view-file-btn"
                                    icon={<EyeOutlined />}
                                    onClick={() => {
                                        if (activeSubmissionId) {
                                            handleViewUpload(activeSubmissionId, file.id, file);
                                        }
                                    }}
                                >
                                    View
                                </Button>
                            </div>
                        ))}
                    </Space>
                ) : (
                    <Empty description="No files found" />
                )}
            </Modal>
        </div>
    );
};

export default RequirementsPage;
