import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { TenantModal } from '../../components/cpanel/TenantModal';

export const TenantsList = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    if (data) setTenants(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce cabinet ? Cela supprimera toutes ses données !")) {
      await supabase.from('tenants').delete().eq('id', id);
      fetchTenants();
    }
  };

  const handleEdit = (tenant: any) => {
    setEditingTenant(tenant);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingTenant(null);
    setIsModalOpen(true);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Gestion des Cabinets</h3>
        <button className="btn btn-primary" onClick={handleAddNew}><Plus size={18} /> Nouveau Cabinet</button>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? (
          <p>Chargement...</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>Nom du cabinet</th>
                <th>Langue par défaut</th>
                <th>Créé le</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{t.name}</td>
                  <td>{t.language.toUpperCase()}</td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleEdit(t)} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', marginRight: '0.5rem' }}>
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun cabinet trouvé</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <TenantModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          tenant={editingTenant} 
          onSuccess={fetchTenants} 
        />
      )}
    </div>
  );
};
