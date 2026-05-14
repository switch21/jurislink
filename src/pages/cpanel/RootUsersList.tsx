import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { UserModal } from '../../components/cpanel/UserModal';

export const RootUsersList = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*, tenant:tenants(name)')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur de la base ?")) {
      await supabase.from('users').delete().eq('id', id);
      fetchUsers();
    }
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Utilisateurs Globaux</h3>
        <button className="btn btn-primary" onClick={handleAddNew}><Plus size={18} /> Nouvel Utilisateur</button>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>Nom</th>
                <th>Email</th>
                <th>Cabinet</th>
                <th>Rôle</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.tenant?.name || '-'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleEdit(u)} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', marginRight: '0.5rem' }}>
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun utilisateur trouvé</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <UserModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          userToEdit={editingUser} 
          onSuccess={fetchUsers} 
        />
      )}
    </div>
  );
};
