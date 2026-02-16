import { useEffect, useState, type ReactNode } from 'react';
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
import MainLayout from './components/layout/MainLayout';
import { authService } from './services/authService';
import ProfilePage from './pages/ProfilePage';
import UsersPage from './pages/UsersPage';
import './index.css';
import { canAccessPath, getAccessLevel, getDefaultRoute, type AccessLevel } from './lib/access';

type AuthState = 'checking' | 'authed' | 'guest';

const RequireAccess = ({ children }: { children: ReactNode }) => {
    const [authState, setAuthState] = useState<AuthState>('checking');
    const [accessLevel, setAccessLevel] = useState<AccessLevel>('pic');
    const location = useLocation();

    useEffect(() => {
        let isActive = true;
        authService
            .me()
            .then((data) => {
                if (isActive) {
                    setAuthState('authed');
                    setAccessLevel(getAccessLevel(data?.user?.roles || []));
                }
            })
            .catch(() => {
                if (isActive) {
                    setAuthState('guest');
                }
            });

        return () => {
            isActive = false;
        };
    }, []);

    if (authState === 'checking') {
        return null;
    }

    if (authState === 'guest') {
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
                        <Route path="audit-trail" element={<AuditTrailPage />} />
                        <Route path="reports" element={<ReportsPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </ConfigProvider>
    );
}

export default App;
