import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Power, PowerOff } from 'lucide-react';
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

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const action = currentStatus ? "désactiver" : "activer";
    if (window.confirm(`Êtes-vous sûr de vouloir ${action} ce cabinet ?`)) {
      await supabase.from('tenants').update({ is_active: !currentStatus }).eq('id', id);
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
                <th style={{ padding: '1rem 0' }}>Cabinet</th>
                <th>Statut</th>
                <th>Plan</th>
                <th>NIU</th>
                <th>Contact</th>
                <th>Créé le</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {t.logo_url && <img src={t.logo_url} alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'contain' }} />}
                      <span style={{ fontWeight: '600' }}>{t.name}</span>
                    </div>
                  </td>
                  <td>
                    {t.is_active !== false ? (
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: 'hsla(var(--success), 0.1)', color: 'hsl(var(--success))' }}>Actif</span>
                    ) : (
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: 'hsla(var(--danger), 0.1)', color: 'hsl(var(--danger))' }}>Inactif</span>
                    )}
                  </td>
                  <td>
                    <span style={{ 
                      padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem',
                      background: t.plan === 'premium' ? 'hsla(var(--primary), 0.1)' : 'hsla(var(--text-muted), 0.1)',
                      color: t.plan === 'premium' ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))'
                    }}>
                      {t.plan?.toUpperCase() || 'STARTER'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{t.niu || '-'}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div>{t.email}</div>
                    <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem' }}>{t.phone}</div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleToggleActive(t.id, t.is_active !== false)} style={{ background: 'none', border: 'none', color: t.is_active !== false ? 'hsl(var(--warning))' : 'hsl(var(--success))', cursor: 'pointer', marginRight: '0.5rem' }} title={t.is_active !== false ? "Désactiver le cabinet" : "Activer le cabinet"}>
                      {t.is_active !== false ? <PowerOff size={18} /> : <Power size={18} />}
                    </button>
                    <button onClick={() => handleEdit(t)} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', marginRight: '0.5rem' }} title="Modifier">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer' }} title="Supprimer">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun cabinet trouvé</td>
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
