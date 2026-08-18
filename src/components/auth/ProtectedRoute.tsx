// ============================================================================
// JurisLink - Phase 2.2 - Nouveau composant: ProtectedRoute
// ============================================================================
// Emplacement: src/components/auth/ProtectedRoute.tsx (nouveau fichier)
//
// Rôle: Garde de route React Router avec vérification d'authentification
// ET vérification de rôle (manquante dans App.tsx ligne 24-29).
//
// Comportement:
//   1. Si isLoading=true → affiche un loader (anti flash de contenu protégé)
//   2. Si !user → redirect /login
//   3. Si requiredRole fournie ET profile.role pas dans la liste → redirect /dashboard
//   4. Sinon → rend les children
//
// Usage:
//   <Route
//     path="audit-logs"
//     element={
//       <ProtectedRoute requiredRole="root_admin">
//         <AuditLogs />
//       </ProtectedRoute>
//     }
//   />
//
//   <ProtectedRoute requiredRole={['firm_admin', 'lawyer']}>
//     <SomePage />
//   </ProtectedRoute>
//
// Note: La défense en profondeur reste active — le RLS Supabase bloque
// les requêtes données même si la garde de rôle est bypassée (URL hacking).
// Ce composant améliore l'UX (pas d'écran d'erreur) et masque l'existence
// des routes aux utilisateurs non autorisés.
// ============================================================================

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, type UserProfile } from '../../store/authStore';

export type UserRole = UserProfile['role'];

interface ProtectedRouteProps {
  /**
   * Rôle(s) autorisé(s) à accéder à la route.
   * - undefined : tous les utilisateurs authentifiés sont autorisés
   * - string : un seul rôle autorisé
   * - string[] : plusieurs rôles autorisés
   */
  requiredRole?: UserRole | UserRole[];
  children: React.ReactNode;
}

/**
 * Vérifie si le rôle de l'utilisateur est autorisé.
 *
 * @param userRole - Le rôle effectif de l'utilisateur (peut être undefined si pas de profil)
 * @param requiredRole - Le rôle ou la liste de rôles requis
 * @returns true si l'accès est autorisé, false sinon
 */
function isRoleAllowed(
  userRole: UserRole | undefined,
  requiredRole: ProtectedRouteProps['requiredRole']
): boolean {
  // Pas de restriction de rôle → tous authentifiés autorisés
  if (requiredRole === undefined) return true;
  // Pas de profil utilisateur → on bloque (ne devrait pas arriver ici
  // car le check user !== null est fait avant, mais par sécurité)
  if (!userRole) return false;
  // Une liste de rôles autorisés
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(userRole);
  }
  // Un seul rôle
  return userRole === requiredRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRole,
  children,
}) => {
  const { user, profile, isLoading } = useAuthStore();

  // État de chargement initial (vérification session Supabase en cours)
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'hsl(var(--primary))',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        Chargement...
      </div>
    );
  }

  // Pas de session → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Vérification de rôle
  if (!isRoleAllowed(profile?.role, requiredRole)) {
    // Redirige vers le dashboard (l'utilisateur verra son propre dashboard)
    // plutôt que d'afficher une page d'erreur 403 — meilleure UX.
    return <Navigate to="/dashboard" replace />;
  }

  // Tout est OK → rend les enfants
  return <>{children}</>;
};

// Export du helper pour les tests
export const __test__ = { isRoleAllowed };
