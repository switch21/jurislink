import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { X } from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceToEdit: any;
  onSuccess: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoiceToEdit, onSuccess }) => {
  const { profile } = useAuthStore();
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [status, setStatus] = useState('draft');
  const [dueDate, setDueDate] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tid = profile?.tenant_id;
    if (tid) {
      supabase.from('clients').select('id, full_name').eq('tenant_id', tid).then(({ data }) => { if (data) setClients(data); });
      supabase.from('cases').select('id, title').eq('tenant_id', tid).then(({ data }) => { if (data) setCases(data); });
    }
    supabase.from('currencies').select('id, code, symbol').then(({ data }) => { if (data) setCurrencies(data); });

    if (invoiceToEdit) {
      setClientId(invoiceToEdit.client_id);
      setCaseId(invoiceToEdit.case_id || '');
      setAmount(String(invoiceToEdit.amount));
      setCurrencyId(invoiceToEdit.currency_id);
      setStatus(invoiceToEdit.status);
      setDueDate(invoiceToEdit.due_date || '');
    } else {
      setClientId(''); setCaseId(''); setAmount(''); setCurrencyId(''); setStatus('draft'); setDueDate('');
    }
    setError('');
  }, [invoiceToEdit, profile]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');

    const payload = {
      client_id: clientId, case_id: caseId || null,
      amount: parseFloat(amount), currency_id: currencyId,
      status, due_date: dueDate || null, tenant_id: profile?.tenant_id
    };

    if (invoiceToEdit) {
      const { error: err } = await supabase.from('invoices').update(payload).eq('id', invoiceToEdit.id);
      if (err) setError(err.message); else { onSuccess(); onClose(); }
    } else {
      const { error: err } = await supabase.from('invoices').insert(payload);
      if (err) setError(err.message); else { onSuccess(); onClose(); }
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><X size={24} /></button>
        <h2 style={{ marginBottom: '1.5rem' }}>{invoiceToEdit ? 'Modifier Facture' : 'Nouvelle Facture'}</h2>
        {error && <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--danger), 0.1)', color: 'hsl(var(--danger))', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Client</label>
            <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">-- Sélectionner --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Dossier (optionnel)</label>
            <select className="input-field" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">-- Aucun --</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Montant</label>
              <input type="number" step="0.01" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Devise</label>
              <select className="input-field" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} required>
                <option value="">--</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Statut</label>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="overdue">En retard</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Échéance</label>
              <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};
