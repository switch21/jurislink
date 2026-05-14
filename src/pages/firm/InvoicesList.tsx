import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { InvoiceModal } from '../../components/firm/InvoiceModal';

export const InvoicesList = () => {
  const { profile } = useAuthStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);

  const fetchInvoices = React.useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from('invoices')
        .select('*, client:clients(full_name), currency:currencies(code, symbol), case:cases(title)')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });
      if (data) setInvoices(data);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Supprimer cette facture ?")) {
      await supabase.from('invoices').delete().eq('id', id);
      fetchInvoices();
    }
  };

  const statusLabels: Record<string, string> = { draft: 'Brouillon', sent: 'Envoyée', paid: 'Payée', overdue: 'En retard', cancelled: 'Annulée' };
  const statusColors: Record<string, string> = { draft: 'var(--text-muted)', sent: 'var(--primary)', paid: 'var(--success)', overdue: 'var(--danger)', cancelled: 'var(--text-muted)' };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Facturation</h3>
        <button className="btn btn-primary" onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Nouvelle Facture
        </button>
      </div>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? <p>Chargement...</p> : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>Client</th><th>Dossier</th><th>Montant</th><th>Statut</th><th>Échéance</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600' }}>{inv.client?.full_name || '-'}</td>
                  <td>{inv.case?.title || '-'}</td>
                  <td>{Number(inv.amount).toLocaleString('fr-FR')} {inv.currency?.symbol || inv.currency?.code || ''}</td>
                  <td>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', background: `hsla(${statusColors[inv.status]}, 0.1)`, color: `hsl(${statusColors[inv.status]})` }}>
                      {statusLabels[inv.status] || inv.status}
                    </span>
                  </td>
                  <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => { setEditingInvoice(inv); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', marginRight: '0.5rem' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(inv.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucune facture</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {isModalOpen && (
        <InvoiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} invoiceToEdit={editingInvoice} onSuccess={fetchInvoices} />
      )}
    </div>
  );
};
