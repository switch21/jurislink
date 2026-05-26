import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, KeyRound, Power, PowerOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { UserModal } from '../../components/cpanel/UserModal';

export const UsersList = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const { profile } = useAuthStore();

  useEffect(() => { if (profile?.tenant_id) fetchUsers(); }, [profile?.tenant_id]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('users').select('*')
      .eq('tenant_id', profile?.tenant_id)
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('users.list.delete_confirm'))) {
      await supabase.from('users').delete().eq('id', id);
      fetchUsers();
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (id === profile?.id) {
      alert("Vous ne pouvez pas désactiver votre propre compte.");
      return;
    }
    const action = currentStatus ? "désactiver" : "activer";
    if (window.confirm(`Êtes-vous sûr de vouloir ${action} cet utilisateur ?`)) {
      await supabase.from('users').update({ is_active: !currentStatus }).eq('id', id);
      fetchUsers();
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword || newPassword.length < 6) {
      setResetMsg(t('users.list.reset_pwd.error_min_length'));
      return;
    }
    setResetLoading(true); setResetMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { user_id: resetUserId, new_password: newPassword }
      });
      if (error) setResetMsg(error.message || 'Erreur');
      else if (data?.error) setResetMsg(data.error);
      else { 
        setResetMsg(t('users.list.reset_pwd.success')); 
        setNewPassword(''); 
        setTimeout(() => { setResetUserId(null); setResetMsg(''); }, 2000); 
      }
    } catch (err: any) { setResetMsg(err.message); }
    setResetLoading(false);
  };

  const handleAddUser = () => {
    const maxUsers = profile?.tenant?.max_users || 3;
    if (users.length >= maxUsers) {
      alert(t('users.list.plan_limit_alert', { plan: profile?.tenant?.plan, max: maxUsers }));
      return;
    }
    setEditingUser(null);
    setIsModalOpen(true);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.25rem' }}>{t('users.list.title')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            {t('users.list.stats', { count: users.length, max: profile?.tenant?.max_users || 3, plan: profile?.tenant?.plan })}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAddUser}>
          <Plus size={18} /> {t('users.list.add_btn')}
        </button>
      </div>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? <p>{t('common.loading')}</p> : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>{t('users.list.table.name')}</th>
                <th>{t('users.list.table.email')}</th>
                <th>Statut</th>
                <th>{t('users.list.table.role')}</th>
                <th style={{ textAlign: 'right' }}>{t('users.list.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.is_active !== false ? (
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: 'hsla(var(--success), 0.1)', color: 'hsl(var(--success))' }}>Actif</span>
                    ) : (
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: 'hsla(var(--danger), 0.1)', color: 'hsl(var(--danger))' }}>Inactif</span>
                    )}
                  </td>
                  <td>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))' }}>
                      {t(`roles.${u.role}`)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', padding: '1rem 0' }}>
                    <button onClick={() => handleToggleActive(u.id, u.is_active !== false)} title={u.is_active !== false ? "Désactiver l'utilisateur" : "Activer l'utilisateur"} style={{ background: 'none', border: 'none', color: u.is_active !== false ? 'hsl(var(--warning))' : 'hsl(var(--success))', cursor: 'pointer' }}>
                      {u.is_active !== false ? <PowerOff size={18} /> : <Power size={18} />}
                    </button>
                    <button onClick={() => { setResetUserId(u.id); setNewPassword(''); setResetMsg(''); }} title={t('users.list.reset_pwd.title')} style={{ background: 'none', border: 'none', color: 'hsl(var(--warning))', cursor: 'pointer' }}><KeyRound size={18} /></button>
                    <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{t('users.list.table.empty')}</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {resetUserId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{t('users.list.reset_pwd.title')}</h3>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>
              {t('users.list.reset_pwd.subtitle')} <strong>{users.find(u => u.id === resetUserId)?.full_name}</strong>
            </p>
            {resetMsg && (
              <div style={{ 
                padding: '0.5rem', 
                borderRadius: 'var(--radius-sm)', 
                marginBottom: '1rem', 
                fontSize: '0.85rem', 
                background: resetMsg.includes('✅') || resetMsg === t('users.list.reset_pwd.success') ? 'hsla(var(--success), 0.1)' : 'hsla(var(--danger), 0.1)', 
                color: resetMsg.includes('✅') || resetMsg === t('users.list.reset_pwd.success') ? 'hsl(var(--success))' : 'hsl(var(--danger))' 
              }}>
                {resetMsg}
              </div>
            )}
            <div className="input-group">
              <label className="input-label">{t('users.list.reset_pwd.field_new')}</label>
              <input type="text" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('users.list.reset_pwd.placeholder')} minLength={6} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={resetLoading} style={{ flex: 1 }}>
                {resetLoading ? t('users.list.reset_pwd.loading') : t('users.list.reset_pwd.btn_confirm')}
              </button>
              <button className="btn btn-secondary" onClick={() => { setResetUserId(null); setResetMsg(''); }} style={{ flex: 1 }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userToEdit={editingUser} onSuccess={fetchUsers} />}
    </div>
  );
};
