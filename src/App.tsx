// ============================================================================
// JurisLink - Phase 5.10 - Patch App.tsx (SessionTimeout + Heartbeat)
// ============================================================================
// Remplace: src/App.tsx (version Phase 4)
//
// Changements vs Phase 4:
//   1. Intégration du composant SessionTimeout à l'intérieur du DashboardLayout
//      (au lieu de le laisser ailleurs — Phase 4 l'avait créé mais pas intégré).
//   2. Démarrage du heartbeat (startHeartbeat) au montage de App, après login.
//   3. Logout immédiat si le heartbeat détecte:
//      - SESSION_MAX_DURATION_EXCEEDED (durée absolue dépassée)
//      - ACCOUNT_DISABLED (compte désactivé depuis le login)
//
// Notes:
//   - Le heartbeat est UNSUBSCRIBED sur signOut() pour éviter les fuites.
//   - Le SessionTimeout affiche aussi le warning de durée max (en plus du
//     timeout d'inactivité — voir SessionTimeout.patch.tsx).
//   - En mode dev (VITE_DEV_DISABLE_HEARTBEAT=true), le heartbeat est
//     désactivé pour faciliter le debug sans logout intempestif.
// ============================================================================

import { useEffect, useRef } from 'react';
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

// Phase 5 imports
import { SessionTimeout } from './components/common/SessionTimeout';
import { startHeartbeat, clearSession } from './lib/sessionManager';
import { clearCsrfToken } from './lib/csrf';
import { supabase } from './lib/supabase';

function App() {
  const { initialize, user, signOut } = useAuthStore();
  const unsubscribeHeartbeatRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Phase 5: démarre le heartbeat après login (et l'arrête après logout)
  useEffect(() => {
    if (!user) {
      // Pas d'utilisateur — arrête le heartbeat si actif
      if (unsubscribeHeartbeatRef.current) {
        unsubscribeHeartbeatRef.current();
        unsubscribeHeartbeatRef.current = null;
      }
      return;
    }

    // Désactivé en dev via env (pour faciliter le debug)
    const disableHeartbeat = import.meta.env.VITE_DEV_DISABLE_HEARTBEAT === 'true';
    if (disableHeartbeat) return;

    // Démarre le heartbeat
    // Callback: si le serveur signale un problème critique → logout forcé
    unsubscribeHeartbeatRef.current = startHeartbeat(
      // onResult (info — pas bloquant)
      (result) => {
        if (!result.ok) {
          console.warn('Session heartbeat result:', result.error ?? 'unknown');
        }
      },
      // onError (critique — logout)
      async (result) => {
        console.warn('Session heartbeat error — forcing logout:', result);
        // Audit log avant logout
        try {
          await supabase.from('audit_logs').insert({
            // tenant_id unknown ici — user peut être désactivé
            user_id: user.id,
            action: 'SESSION_HEARTBEAT_FAILED',
            entity: 'auth',
            entity_id: user.id,
            metadata: {
              ip: null,
              user_agent: navigator.userAgent,
              source: 'UI:App:heartbeat',
              error: result.error ?? 'unknown',
              max_duration_exceeded: result.maxDurationExceeded ?? false,
              account_disabled: result.accountDisabled ?? false,
            },
          });
        } catch (e) {
          console.error('Failed to log heartbeat failure:', e);
        }
        clearCsrfToken();
        clearSession();
        await signOut();
      }
    );

    // Cleanup au unmount ou quand user change
    return () => {
      if (unsubscribeHeartbeatRef.current) {
        unsubscribeHeartbeatRef.current();
        unsubscribeHeartbeatRef.current = null;
      }
    };
  }, [user, signOut]);

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
              <SessionTimeout />
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
