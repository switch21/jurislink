import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import { DashboardLayout } from './components/layouts/DashboardLayout';
import { Login } from './pages/auth/Login';
import { Overview } from './pages/dashboard/Overview';
import { TenantsList } from './pages/cpanel/TenantsList';
import { CurrenciesList } from './pages/cpanel/CurrenciesList';
import { RootUsersList } from './pages/cpanel/RootUsersList';
import { AuditLogs } from './pages/cpanel/AuditLogs';
import { UsersList } from './pages/firm/UsersList';
import { CasesList } from './pages/firm/CasesList';
import { ClientsList } from './pages/firm/ClientsList';
import { CalendarPage } from './pages/firm/CalendarPage';
import { EventHistory } from './pages/firm/EventHistory';
import { DocumentsList } from './pages/firm/DocumentsList';
import { InvoicesList } from './pages/firm/InvoicesList';
import { MessagesPage } from './pages/firm/MessagesPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'hsl(var(--primary))' }}>Chargement...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  const { initialize } = useAuthStore();
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<Overview />} />
          <Route path="tenants" element={<TenantsList />} />
          <Route path="currencies" element={<CurrenciesList />} />
          <Route path="root-users" element={<RootUsersList />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="users" element={<UsersList />} />
          <Route path="clients" element={<ClientsList />} />
          <Route path="cases" element={<CasesList />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="event-history" element={<EventHistory />} />
          <Route path="documents" element={<DocumentsList />} />
          <Route path="invoices" element={<InvoicesList />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
