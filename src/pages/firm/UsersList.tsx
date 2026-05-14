import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, KeyRound } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { UserModal } from '../../components/cpanel/UserModal';

export const UsersList = () => {
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
    if (window.confirm("Supprimer ce membre de l'équipe ?")) {
      await supabase.from('users').delete().eq('id', id);
      fetchUsers();
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword || newPassword.length < 6) {
      setResetMsg('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setResetLoading(true); setResetMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { user_id: resetUserId, new_password: newPassword }
      });
      if (error) setResetMsg(error.message || 'Erreur');
      else if (data?.error) setResetMsg(data.error);
      else { setResetMsg('✅ Mot de passe modifié avec succès'); setNewPassword(''); setTimeout(() => { setResetUserId(null); setResetMsg(''); }, 2000); }
    } catch (err: any) { setResetMsg(err.message); }
    setResetLoading(false);
  };

  const roleLabels: Record<string, string> = { firm_admin: 'Admin', lawyer: 'Avocat', secretary: 'Secrétaire' };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Gestion de l'équipe</h3>
        <button className="btn btn-primary" onClick={() => { setEditingUser(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Ajouter un membre
        </button>
      </div>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? <p>Chargement...</p> : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>Nom</th><th>Email</th><th>Rôle</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))' }}>{roleLabels[u.role] || u.role}</span></td>
                  <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                    <button onClick={() => { setResetUserId(u.id); setNewPassword(''); setResetMsg(''); }} title="Réinitialiser le mot de passe" style={{ background: 'none', border: 'none', color: 'hsl(var(--warning))', cursor: 'pointer' }}><KeyRound size={18} /></button>
                    <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun membre</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Password Reset Modal */}
      {resetUserId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>Réinitialiser le mot de passe</h3>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '1rem' }}>
              Membre: <strong>{users.find(u => u.id === resetUserId)?.full_name}</strong>
            </p>
            {resetMsg && <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem', background: resetMsg.includes('✅') ? 'hsla(var(--success), 0.1)' : 'hsla(var(--danger), 0.1)', color: resetMsg.includes('✅') ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>{resetMsg}</div>}
            <div className="input-group">
              <label className="input-label">Nouveau mot de passe</label>
              <input type="text" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 caractères" minLength={6} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={resetLoading} style={{ flex: 1 }}>
                {resetLoading ? 'En cours...' : 'Confirmer'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setResetUserId(null); setResetMsg(''); }} style={{ flex: 1 }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && <UserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userToEdit={editingUser} onSuccess={fetchUsers} />}
    </div>
  );
};
