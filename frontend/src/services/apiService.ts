import api, { API_ROOT_URL } from '../lib/api';
import type { Agency, BranchUnitDepartment, PaginatedResponse, Position, Requirement, Upload, User } from '../types';

const getCookie = (name: string) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || '';
    }
    return '';
};

const getCsrfHeaders = () => {
    const xsrfToken = decodeURIComponent(getCookie('XSRF-TOKEN'));
    return xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : undefined;
};

const getRootUrl = () => API_ROOT_URL;

export const agencyService = {
    getAll: async (params?: { active_only?: boolean }) =>
        (await api.get<Agency[]>('/agencies', { params })).data,
    create: async (data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<Agency>('/agencies', data, { headers: getCsrfHeaders() })).data;
    },
    update: async (id: number, data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.put<Agency>(`/agencies/${id}`, data, { headers: getCsrfHeaders() })).data;
    },
    delete: async (id: number) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return await api.delete(`/agencies/${id}`, { headers: getCsrfHeaders() });
    },
};

export const branchUnitDepartmentService = {
    getAll: async (params?: { active_only?: boolean }) =>
        (await api.get<BranchUnitDepartment[]>('/branch-unit-departments', { params })).data,
    create: async (data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<BranchUnitDepartment>('/branch-unit-departments', data, { headers: getCsrfHeaders() })).data;
    },
    update: async (id: number, data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.put<BranchUnitDepartment>(`/branch-unit-departments/${id}`, data, { headers: getCsrfHeaders() })).data;
    },
    delete: async (id: number) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return await api.delete(`/branch-unit-departments/${id}`, { headers: getCsrfHeaders() });
    },
};

export const positionService = {
    getAll: async (params?: { active_only?: boolean }) =>
        (await api.get<Position[]>('/positions', { params })).data,
    create: async (data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<Position>('/positions', data, { headers: getCsrfHeaders() })).data;
    },
    update: async (id: number, data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.put<Position>(`/positions/${id}`, data, { headers: getCsrfHeaders() })).data;
    },
    delete: async (id: number) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return await api.delete(`/positions/${id}`, { headers: getCsrfHeaders() });
    },
};

export const requirementService = {
    getAll: async (params?: {
        page?: number;
        per_page?: number;
        search?: string;
        agency_id?: number;
        category?: string;
        compliance_status?: string;
        status?: 'compliant' | 'complied' | 'pending' | 'overdue' | 'na';
        sort_by?: 'id' | 'req_id' | 'requirement';
        sort_dir?: 'asc' | 'desc';
    }) => (await api.get<PaginatedResponse<Requirement>>('/requirements', { params })).data,
    getMine: async () => (await api.get<Requirement[]>('/requirements/my')).data,
    exportCsv: async (params?: {
        search?: string;
        agency_id?: number;
        category?: string;
    }) => (await api.get('/requirements/export', { params, responseType: 'blob' })).data,
    create: async (data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<Requirement>('/requirements', data, { headers: getCsrfHeaders() })).data;
    },
    show: async (id: number) => (await api.get<Requirement>(`/requirements/${id}`)).data,
    update: async (id: number, data: any) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.put<Requirement>(`/requirements/${id}`, data, { headers: getCsrfHeaders() })).data;
    },
    delete: async (id: number) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return await api.delete(`/requirements/${id}`, { headers: getCsrfHeaders() });
    },
    import: async (file: File) => {
        const rootUrl = getRootUrl();
        const formData = new FormData();
        formData.append('file', file);
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post('/requirements/import', formData, {
            headers: {
                ...getCsrfHeaders(),
                'Content-Type': 'multipart/form-data',
            },
        })).data;
    },
};

export const uploadService = {
    upload: async (data: FormData) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<Upload>('/uploads', data, {
            headers: {
                ...getCsrfHeaders(),
                'Content-Type': 'multipart/form-data',
            },
        })).data;
    },
    getAll: async () => (await api.get<Upload[]>('/uploads')).data,
    approve: async (id: number, remarks: string) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<Upload>(`/uploads/${id}/approve`, { remarks }, { headers: getCsrfHeaders() })).data;
    },
    reject: async (id: number, remarks: string) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<Upload>(`/uploads/${id}/reject`, { remarks }, { headers: getCsrfHeaders() })).data;
    },
    download: async (id: number, inline = false) =>
        (await api.get(`/uploads/${id}/download`, { params: { inline }, responseType: 'blob' })).data,
    getSignedUrl: async (id: number, inline = false) =>
        (await api.get<{ url: string }>(`/uploads/${id}/signed-url`, { params: { inline } })).data,
};

export const dashboardService = {
    getStats: async () => (await api.get<{
        total_agencies: number;
        total_requirements: number;
        compliant: number;
        pending: number;
        overdue: number;
        for_approval: number;
        compliance_rate: number;
    }>('/dashboard/stats')).data,
    getActivity: async () => (await api.get<any[]>('/dashboard/activity')).data,
    getAgencyStats: async () => (await api.get<{
        agency: string;
        name: string;
        total: number;
        na: number;
        pending: number;
        overdue: number;
        complied: number;
    }[]>('/dashboard/agency-stats')).data,
    getCalendar: async () => (await api.get<Record<string, { id: number; name: string; status: 'pending' | 'complied' | 'overdue' | 'na' | 'for_approval'; pic?: string; }[]>>('/dashboard/calendar')).data,
};

export const auditService = {
    getLogs: async () => (await api.get<any>('/audit-logs')).data,
};

export const profileService = {
    get: async () => (await api.get<{ user: User }>('/profile')).data,
    update: async (data: Pick<User, 'employee_name' | 'branch' | 'email' | 'user_type'>) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.put<{ user: User }>('/profile', data, { headers: getCsrfHeaders() })).data;
    },
    updatePassword: async (data: { current_password: string; password: string; password_confirmation: string }) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        await api.put('/profile/password', data, { headers: getCsrfHeaders() });
    },
};

export const userService = {
    getAll: async () => (await api.get<any>('/users')).data,
    create: async (data: {
        employee_name: string;
        email: string;
        branch: string;
        user_type: string;
        password: string;
        is_active: boolean;
    }) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post<{ user: User }>('/users', data, { headers: getCsrfHeaders() })).data;
    },
    update: async (id: number, data: {
        employee_name: string;
        email: string;
        branch: string;
        user_type: string;
        is_active: boolean;
    }) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.put<{ user: User }>(`/users/${id}`, data, { headers: getCsrfHeaders() })).data;
    },
    resetPassword: async (id: number, data: { password: string; password_confirmation: string }) => {
        const rootUrl = getRootUrl();
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        await api.put(`/users/${id}/password`, data, { headers: getCsrfHeaders() });
    },
    import: async (file: File) => {
        const rootUrl = getRootUrl();
        const formData = new FormData();
        formData.append('file', file);
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        return (await api.post('/users/import', formData, {
            headers: {
                ...getCsrfHeaders(),
                'Content-Type': 'multipart/form-data',
            },
        })).data;
    },
};
