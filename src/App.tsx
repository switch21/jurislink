// ============================================================================
// JurisLink - Phase 2.3 - Patch App.tsx (intégration ProtectedRoute + rôles)
// ============================================================================
// Remplace: src/App.tsx
//
// Changements vs version actuelle:
//   1. Suppression du ProtectedRoute inline (lignes 24-29) — remplacé par le
//      nouveau composant src/components/auth/ProtectedRoute.tsx qui gère
//      aussi les rôles.
//   2. Déclaration explicite des rôles requis sur chaque route admin/firm.
//   3. Les routes protégées par rôle sont maintenant WRAPPER autour de
//      chaque composant de page individuellement (pas autour du DashboardLayout)
//      — cela permet au layout commun de rester accessible, et seules les
//      pages sensibles sont filtrées.
//
// Mapping des rôles par route (justification):
//   - tenants, currencies, root-users, audit-logs → root_admin uniquement
//     (gestion multi-tenant + audit système)
//   - users → firm_admin uniquement (gestion de l'équipe du cabinet)
//   - cases, calendar, documents, invoices, event-history, messages, archives
//     → firm_admin + lawyer + secretary (collaborateurs du cabinet)
//   - clients → firm_admin + lawyer + secretary (le client lui-même n'a pas
//     accès à la liste des autres clients)
//   - Overview (index) → tous authentifiés (vue d'accueil)
// ============================================================================

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
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
import { ArchivesList } from './pages/firm/ArchivesList';

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Rôles collaborateurs du cabinet (firm scope)
  const FIRM_STAFF = ['firm_admin', 'lawyer', 'secretary'] as const;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Route parente: authentification requise (pas de rôle spécifique) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Vue d'accueil — tous authentifiés */}
          <Route index element={<Overview />} />

          {/* Routes root_admin (cpanel) */}
          <Route
            path="tenants"
            element={
              <ProtectedRoute requiredRole="root_admin">
                <TenantsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="currencies"
            element={
              <ProtectedRoute requiredRole="root_admin">
                <CurrenciesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="root-users"
            element={
              <ProtectedRoute requiredRole="root_admin">
                <RootUsersList />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit-logs"
            element={
              <ProtectedRoute requiredRole="root_admin">
                <AuditLogs />
              </ProtectedRoute>
            }
          />

          {/* Routes firm_admin (gestion équipe) */}
          <Route
            path="users"
            element={
              <ProtectedRoute requiredRole="firm_admin">
                <UsersList />
              </ProtectedRoute>
            }
          />

          {/* Routes firm_admin + lawyer + secretary (firm scope) */}
          <Route
            path="clients"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <ClientsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="cases"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <CasesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="calendar"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="event-history"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <EventHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="documents"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <DocumentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="invoices"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <InvoicesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="messages"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="archives"
            element={
              <ProtectedRoute requiredRole={[...FIRM_STAFF]}>
                <ArchivesList />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
