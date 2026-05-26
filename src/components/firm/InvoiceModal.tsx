import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Portal } from '../common/Portal';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceToEdit: any;
  onSuccess: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, invoiceToEdit, onSuccess }) => {
  const { t } = useTranslation();
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
    const fetchData = async () => {
      const tid = profile?.tenant_id;
      if (!tid || !isOpen) return;

      try {
        const { data: clientsData } = await supabase.from('clients').select('id, full_name').eq('tenant_id', tid);
        if (clientsData) setClients(clientsData);

        let query = supabase.from('cases').select('id, title');
        if (profile.role === 'lawyer') {
          const { data: assignments } = await supabase
            .from('case_assignments')
            .select('case_id')
            .eq('user_id', profile.id)
            .eq('tenant_id', tid);
          
          const assignedIds = assignments?.map(a => a.case_id) || [];
          if (assignedIds.length > 0) {
            query = query.in('id', assignedIds);
          } else {
            setCases([]);
            return;
          }
        } else {
          query = query.eq('tenant_id', tid);
        }

        const { data: casesData } = await query.order('created_at', { ascending: false });
        if (casesData) setCases(casesData);

        const { data: currenciesData } = await supabase.from('currencies').select('id, code, symbol');
        if (currenciesData) setCurrencies(currenciesData);
      } catch (err) {
        console.error('Error fetching data for invoice modal:', err);
      }
    };

    fetchData();

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
  }, [invoiceToEdit, profile, isOpen]);

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
    <Portal>
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, 
      padding: '1rem' 
    }}>
      <div className="glass-card animate-fade-in" style={{ 
        padding: '2.5rem', 
        width: '100%', 
        maxWidth: '600px', 
        maxHeight: '90vh', 
        overflowY: 'auto', 
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <button onClick={onClose} style={{ 
          position: 'absolute', top: '1.5rem', right: '1.5rem', 
          background: 'hsla(var(--text-muted), 0.1)', border: 'none', 
          color: 'hsl(var(--text-muted))', cursor: 'pointer',
          width: '32px', height: '32px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} className="hover-scale">
          <X size={20} />
        </button>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
            {invoiceToEdit ? t('cases.invoices.modal.edit_title') : t('cases.invoices.modal.new_title')}
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
            {t('cases.invoices.modal.subtitle')}
          </p>
        </div>
        
        {error && <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'hsla(var(--danger), 0.1)', color: 'hsl(var(--danger))', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid hsla(var(--danger), 0.2)' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              {t('cases.invoices.modal.section_id')}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">{t('cases.invoices.modal.field_client')}</label>
                <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  <option value="">{t('cases.invoices.modal.select_prompt')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{t('cases.invoices.modal.field_case')}</label>
                <select className="input-field" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                  <option value="">{t('cases.invoices.modal.none')}</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              {t('cases.invoices.modal.section_amount')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
                <div className="input-group">
                  <label className="input-label">{t('cases.invoices.modal.field_amount')}</label>
                  <input type="number" step="0.01" className="input-field" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label className="input-label">{t('cases.invoices.modal.field_currency')}</label>
                  <select className="input-field" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} required>
                    <option value="">--</option>
                    {currencies.map(c => <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>)}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="input-group">
                  <label className="input-label">{t('cases.invoices.modal.field_status')}</label>
                  <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)} style={{ fontWeight: 600 }}>
                    <option value="draft">{t('cases.invoices.modal.status.draft')}</option>
                    <option value="sent">{t('cases.invoices.modal.status.sent')}</option>
                    <option value="paid">{t('cases.invoices.modal.status.paid')}</option>
                    <option value="overdue">{t('cases.invoices.modal.status.overdue')}</option>
                    <option value="cancelled">{t('cases.invoices.modal.status.cancelled')}</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">{t('cases.invoices.modal.field_due_date')}</label>
                  <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              {status === 'paid' && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--success), 0.1)', color: 'hsl(var(--success))', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✓</span>
                  <span>{t('cases.invoices.modal.receipt_notice')}</span>
                </div>
              )}
            </div>
          </section>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button type="button" onClick={onClose} className="btn" style={{ flex: 1 }}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? t('cases.invoices.modal.saving') : (invoiceToEdit ? t('cases.invoices.modal.update_btn') : t('cases.invoices.modal.create_btn'))}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};
