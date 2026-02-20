import api, { API_ROOT_URL } from '../lib/api';
import type { User } from '../types';

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

export const authService = {
    login: async (credentials: { email: string; password: string }) => {
        const rootUrl = API_ROOT_URL;
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        const response = await api.post('/login', credentials, {
            baseURL: rootUrl,
            headers: getCsrfHeaders(),
        });
        return response.data;
    },
    logout: async () => {
        const rootUrl = API_ROOT_URL;
        await api.get('/sanctum/csrf-cookie', { baseURL: rootUrl });
        await api.post('/logout', {}, { baseURL: rootUrl, headers: getCsrfHeaders() });
    },
    me: async () => {
        const response = await api.get<{ user: User }>('/me');
        return response.data;
    },
};
