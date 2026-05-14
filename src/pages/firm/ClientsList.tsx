import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Phone, Mail, Building, MapPin, FolderOpen } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { ClientModal } from '../../components/firm/ClientModal';

export const ClientsList = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientCases, setClientCases] = useState<Record<string, any[]>>({});
  const { profile } = useAuthStore();

  const fetchClients = React.useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from('clients').select('*')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });
      if (data) {
        setClients(data);
        const { data: cases } = await supabase.from('cases').select('id, title, client_id, status, outcome, payment_status')
          .eq('tenant_id', profile?.tenant_id);
        if (cases) {
          const grouped: Record<string, any[]> = {};
          cases.forEach(c => { if (!grouped[c.client_id]) grouped[c.client_id] = []; grouped[c.client_id].push(c); });
          setClientCases(grouped);
        }
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Supprimer ce client ?")) {
      await supabase.from('clients').delete().eq('id', id);
      fetchClients();
    }
  };

  const statusLabels: Record<string, string> = { open: 'Ouvert', closed: 'Clôturé', pending: 'En attente', archived: 'Archivé' };
  const paymentLabels: Record<string, string> = { pending: 'En attente', partial: 'Partiel', paid: 'Payé' };
  const statusColors: Record<string, string> = { open: 'var(--primary)', closed: 'var(--success)', pending: 'var(--warning)', archived: 'var(--text-muted)' };
  const paymentColors: Record<string, string> = { pending: 'var(--warning)', partial: 'var(--primary)', paid: 'var(--success)' };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Gestion des Clients</h3>
        <button className="btn btn-primary" onClick={() => { setEditingClient(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Nouveau Client
        </button>
      </div>

      {loading ? <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {clients.length === 0 && <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun client enregistré</div>}
          {clients.map(c => {
            const cases = clientCases[c.id] || [];
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="glass-card" style={{ padding: '1.25rem', transition: 'var(--transition)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-full)', background: 'hsla(var(--primary), 0.12)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                        {c.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{c.full_name}</div>
                        {c.company && <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Building size={12} /> {c.company}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
                      {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={13} /> {c.phone}</span>}
                      {c.email && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={13} /> {c.email}</span>}
                      {c.address && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={13} /> {c.address}</span>}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FolderOpen size={13} /> {cases.length} dossier{cases.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button onClick={() => { setEditingClient(c); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </div>
                </div>

                {/* Expanded: show cases */}
                {isExpanded && cases.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsla(var(--text-muted), 0.1)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Dossiers du client</div>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead><tr style={{ color: 'hsl(var(--text-muted))' }}>
                        <th style={{ padding: '0.4rem 0' }}>Dossier</th><th>Statut</th><th>Résultat</th><th>Paiement</th>
                      </tr></thead>
                      <tbody>
                        {cases.map((cs: any) => (
                          <tr key={cs.id} style={{ borderTop: '1px solid hsla(var(--text-muted), 0.06)' }}>
                            <td style={{ padding: '0.4rem 0' }}>{cs.title}</td>
                            <td><span style={{ padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: `hsla(${statusColors[cs.status]}, 0.1)`, color: `hsl(${statusColors[cs.status]})` }}>{statusLabels[cs.status]}</span></td>
                            <td style={{ textTransform: 'capitalize' }}>{cs.outcome === 'ongoing' ? 'En cours' : cs.outcome === 'won' ? 'Gagné' : cs.outcome === 'lost' ? 'Perdu' : cs.outcome === 'settled' ? 'Réglé' : cs.outcome}</td>
                            <td><span style={{ padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: `hsla(${paymentColors[cs.payment_status]}, 0.1)`, color: `hsl(${paymentColors[cs.payment_status]})` }}>{paymentLabels[cs.payment_status]}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {isExpanded && cases.length === 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid hsla(var(--text-muted), 0.1)', fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Aucun dossier associé</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && <ClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} clientToEdit={editingClient} onSuccess={fetchClients} />}
    </div>
  );
};
