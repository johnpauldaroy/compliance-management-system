export type AccessLevel = 'super' | 'admin' | 'pic';

type RoleLike = { name?: string | null };

const hasRole = (roles: RoleLike[] | null | undefined, names: string[]) =>
    Boolean(roles?.some((role) => names.includes(role?.name || '')));

const normalizePath = (path: string) => {
    if (!path) {
        return '/';
    }
    const trimmed = path.replace(/\/+$/, '');
    return trimmed === '' ? '/' : trimmed;
};

export const getAccessLevel = (roles: RoleLike[] | null | undefined): AccessLevel => {
    if (hasRole(roles, ['Super Admin'])) {
        return 'super';
    }
    if (hasRole(roles, ['Compliance & Admin Specialist', 'Admin Specialist'])) {
        return 'admin';
    }
    return 'pic';
};

export const canAccessPath = (accessLevel: AccessLevel, path: string) => {
    const normalized = normalizePath(path);

    if (normalized === '/login' || normalized === '/profile') {
        return true;
    }

    if (accessLevel === 'super') {
        return true;
    }

    if (accessLevel === 'admin') {
        return normalized !== '/audit-trail';
    }

    return normalized === '/' || normalized === '/my-requirements';
};

export const isMenuKeyAllowed = (accessLevel: AccessLevel, key: string) => {
    if (accessLevel === 'super') {
        return true;
    }

    if (accessLevel === 'admin') {
        return key !== '/audit-trail';
    }

    return key === '/' || key === '/my-requirements';
};

export const getDefaultRoute = (accessLevel: AccessLevel) => {
    if (accessLevel === 'pic') {
        return '/';
    }
    return '/';
};
