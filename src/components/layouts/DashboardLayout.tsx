import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { ActivityTracker } from '../common/ActivityTracker';
import { 
  Scale, LayoutDashboard, Briefcase, Calendar, FileText, CreditCard,
  MessageSquare, LogOut, Menu, X, Users, FolderOpen, Clock, History
} from 'lucide-react';
import { NotificationBell } from '../firm/NotificationBell';
import { LanguageSelector } from '../firm/LanguageSelector';
import { ErrorBoundary } from '../common/ErrorBoundary';
import './DashboardLayout.css';

export const DashboardLayout = () => {
  const { t } = useTranslation();
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => { 
    try {
      await signOut(); 
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/login';
    }
  };

  const role = profile?.role;
  const plan = profile?.tenant?.plan || 'starter';

  const getMenuItems = () => {
    let items = [];
    switch (role) {
      case 'root_admin':
        items = [
          { path: '/dashboard', label: t('dashboard.overview'), icon: <LayoutDashboard size={20} /> },
          { path: '/dashboard/tenants', label: t('sidebar.tenants', 'Cabinets'), icon: <Briefcase size={20} /> },
          { path: '/dashboard/root-users', label: t('sidebar.users', 'Utilisateurs'), icon: <Users size={20} /> },
          { path: '/dashboard/currencies', label: t('sidebar.currencies', 'Devises'), icon: <CreditCard size={20} /> },
          { path: '/dashboard/audit-logs', label: t('sidebar.audit_logs', "Journal d'audit"), icon: <History size={20} /> },
        ];
        break;
      case 'firm_admin':
        items = [
          { path: '/dashboard', label: t('dashboard.overview'), icon: <LayoutDashboard size={20} /> },
          { path: '/dashboard/users', label: t('sidebar.team', 'Équipe'), icon: <Users size={20} /> },
          { path: '/dashboard/clients', label: t('sidebar.clients', 'Clients'), icon: <Briefcase size={20} /> },
          { path: '/dashboard/cases', label: t('dashboard.cases'), icon: <FolderOpen size={20} /> },
          { path: '/dashboard/calendar', label: t('dashboard.calendar'), icon: <Calendar size={20} />, restricted: plan === 'starter' },
          { path: '/dashboard/event-history', label: t('sidebar.history', 'Historique'), icon: <Clock size={20} /> },
          { path: '/dashboard/documents', label: t('dashboard.documents'), icon: <FileText size={20} /> },
          { path: '/dashboard/invoices', label: t('dashboard.invoices'), icon: <CreditCard size={20} />, restricted: plan === 'starter' },
          { path: '/dashboard/messages', label: t('dashboard.messages'), icon: <MessageSquare size={20} />, restricted: plan === 'starter' },
        ];
        break;
      case 'lawyer':
      case 'secretary':
        items = [
          { path: '/dashboard', label: t('dashboard.overview'), icon: <LayoutDashboard size={20} /> },
          { path: '/dashboard/clients', label: t('sidebar.clients', 'Clients'), icon: <Briefcase size={20} /> },
          { path: '/dashboard/cases', label: t('dashboard.cases'), icon: <FolderOpen size={20} /> },
          { path: '/dashboard/calendar', label: t('dashboard.calendar'), icon: <Calendar size={20} />, restricted: plan === 'starter' },
          { path: '/dashboard/event-history', label: t('sidebar.history', 'Historique'), icon: <Clock size={20} /> },
          { path: '/dashboard/documents', label: t('dashboard.documents'), icon: <FileText size={20} /> },
          { path: '/dashboard/invoices', label: t('dashboard.invoices'), icon: <CreditCard size={20} />, restricted: plan === 'starter' },
          { path: '/dashboard/messages', label: t('dashboard.messages'), icon: <MessageSquare size={20} />, restricted: plan === 'starter' },
        ];
        break;
      default:
        items = [{ path: '/dashboard', label: t('dashboard.overview'), icon: <LayoutDashboard size={20} /> }];
    }
    return items.filter(item => !item.restricted);
  };

  const menuItems = getMenuItems();
  const roleLabels: Record<string, string> = { 
    root_admin: t('roles.root_admin', 'Administrateur Système'), 
    firm_admin: t('roles.firm_admin', 'Administrateur Cabinet'), 
    lawyer: t('roles.lawyer', 'Avocat'), 
    secretary: t('roles.secretary', 'Secrétaire'),
    client: t('roles.client', 'Client')
  };

  return (
    <>
    <ActivityTracker />
    <div className="dashboard-container">
      <div className="mobile-header" style={{ height: 'auto', padding: '0.5rem 1rem' }}>
        <div className="logo-container-small" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <img src={role === 'root_admin' ? '/logo-full.png' : (profile?.tenant?.logo_url || '/logo.png')} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
          {role !== 'root_admin' && profile?.tenant?.name && <span style={{ fontWeight: 700, fontSize: '0.75rem', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{profile.tenant.name}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LanguageSelector />
          {role !== 'root_admin' && <NotificationBell />}
          <button className="menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <aside className={`sidebar glass-card ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ height: 'auto', padding: '1rem 1rem' }}>
          <div className="logo-container-small" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <img src={role === 'root_admin' ? '/logo-full.png' : (profile?.tenant?.logo_url || '/logo.png')} alt="Logo" style={{ height: '80px', objectFit: 'contain', maxWidth: '100%' }} />
            {role !== 'root_admin' && profile?.tenant?.name && <span style={{ fontWeight: 700, fontSize: '1rem', marginTop: '0.2rem', textAlign: 'center' }}>{profile.tenant.name}</span>}
          </div>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button key={item.path}
              className={`nav-item ${location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/dashboard') ? 'active' : ''}`}
              onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">{profile?.full_name?.charAt(0) || 'U'}</div>
            <div className="user-info">
              <span className="user-name">{profile?.full_name || 'Utilisateur'}</span>
              <span className="user-role">{roleLabels[profile?.role || ''] || profile?.role || '...'}</span>
            </div>
          </div>
          <button className="nav-item logout-btn" onClick={handleSignOut}><LogOut size={20} /><span>{t('dashboard.logout')}</span></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{menuItems.find(m => m.path === location.pathname || (location.pathname.startsWith(m.path) && m.path !== '/dashboard'))?.label || 'JurisLink'}</h2>
          <div className="desktop-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <LanguageSelector />
            {role !== 'root_admin' && <div className="desktop-notifications"><NotificationBell /></div>}
          </div>
        </header>
        <div className="content-scrollable animate-fade-in">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
      
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>}
    </div>
    </>
  );
};
