import { type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AgenciesPage from './pages/AgenciesPage';
import RequirementsPage from './pages/RequirementsPage';
import MyRequirementsPage from './pages/MyRequirementsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import AuditTrailPage from './pages/AuditTrailPage';
import ReportsPage from './pages/ReportsPage';
import UserManualPage from './pages/UserManualPage';
import MainLayout from './components/layout/MainLayout';
import { authService } from './services/authService';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import './index.css';
import { canAccessPath, getAccessLevel, getDefaultRoute, type AccessLevel } from './lib/access';
import LoadingScreen from './components/common/LoadingScreen';
import { useQuery } from '@tanstack/react-query';

const RequireAccess = ({ children }: { children: ReactNode }) => {
    const location = useLocation();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['me'],
        queryFn: authService.me,
        retry: false,
    });

    const accessLevel: AccessLevel = getAccessLevel(data?.user?.roles || []);

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (isError) {
        return <Navigate to="/login" replace />;
    }

    if (!canAccessPath(accessLevel, location.pathname)) {
        return <Navigate to={getDefaultRoute(accessLevel)} replace />;
    }

    return <>{children}</>;
};

function App() {
    return (
        <ConfigProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/"
                        element={(
                            <RequireAccess>
                                <MainLayout />
                            </RequireAccess>
                        )}
                    >
                        <Route index element={<Dashboard />} />
                        <Route path="agencies" element={<AgenciesPage />} />
                        <Route path="requirements" element={<RequirementsPage />} />
                        <Route path="my-requirements" element={<MyRequirementsPage />} />
                        <Route path="uploads" element={<ApprovalsPage />} />
                        <Route path="users" element={<UsersPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="audit-trail" element={<AuditTrailPage />} />
                        <Route path="user-manual" element={<UserManualPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </ConfigProvider>
    );
}

export default App;
