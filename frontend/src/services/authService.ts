import api from '../lib/api';
import type { User } from '../types';

export const authService = {
    login: async (credentials: { email: string; password: string }) => {
        const response = await api.post('/login', credentials);
        if (response.data?.token) {
            localStorage.setItem('auth_token', response.data.token);
        }
        return response.data;
    },
    logout: async () => {
        await api.post('/logout');
        localStorage.removeItem('auth_token');
    },
    me: async () => {
        const response = await api.get<{ user: User }>('/me');
        return response.data;
    },
};
