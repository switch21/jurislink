import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { X, Lock, Users } from 'lucide-react';
import { Portal } from '../common/Portal';

interface CaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseToEdit: any;
  onSuccess: () => void;
}

export const CaseModal: React.FC<CaseModalProps> = ({ isOpen, onClose, caseToEdit, onSuccess }) => {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('open');
  const [outcome, setOutcome] = useState('ongoing');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [isSecret, setIsSecret] = useState(false);
  
  const [clients, setClients] = useState<any[]>([]);
  const [firmUsers, setFirmUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (profile?.tenant_id) {
        supabase.from('clients').select('id, full_name')
          .eq('tenant_id', profile.tenant_id).order('full_name')
          .then(({ data }) => { if (data) setClients(data); });

        supabase.from('users').select('id, full_name, role')
          .eq('tenant_id', profile.tenant_id)
          .then(({ data }) => { if (data) setFirmUsers(data); });
      }

      if (caseToEdit) {
        setTitle(caseToEdit.title); 
        setDescription(caseToEdit.description || '');
        setClientId(caseToEdit.client_id); 
        setStatus(caseToEdit.status);
        setOutcome(caseToEdit.outcome || 'ongoing');
        setPaymentStatus(caseToEdit.payment_status || 'pending');
        setIsSecret(caseToEdit.is_secret || false);

        const { data: assignments } = await supabase.from('case_assignments')
          .select('user_id').eq('case_id', caseToEdit.id);
        if (assignments) {
          setAssignedUsers(assignments.map(a => a.user_id));
        }
      } else {
        setTitle(''); setDescription(''); setClientId('');
        setStatus('open'); setOutcome('ongoing'); setPaymentStatus('pending');
        setIsSecret(false);
        setAssignedUsers([]);
      }
      setError('');
    };

    if (isOpen) loadData();
  }, [caseToEdit, profile, isOpen]);

  if (!isOpen) return null;

  const toggleUserAssignment = (userId: string) => {
    setAssignedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    if (!clientId) { setError(t('cases.modal.error_select_client')); setLoading(false); return; }

    const payload = { 
      title, description, client_id: clientId, tenant_id: profile?.tenant_id, 
      status, outcome, payment_status: paymentStatus, is_secret: isSecret 
    };

    let savedCaseId = caseToEdit?.id;

    if (caseToEdit) {
      const { tenant_id, ...up } = payload;
      const { error: err } = await supabase.from('cases').update(up).eq('id', caseToEdit.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { data, error: err } = await supabase.from('cases').insert(payload).select('id').single();
      if (err) { setError(err.message); setLoading(false); return; }
      if (data) savedCaseId = data.id;
    }

    if (savedCaseId) {
      await supabase.from('case_assignments').delete().eq('case_id', savedCaseId);
      
      if (assignedUsers.length > 0) {
        const assignmentsPayload = assignedUsers.map(userId => ({
          tenant_id: profile?.tenant_id,
          case_id: savedCaseId,
          user_id: userId
        }));
        await supabase.from('case_assignments').insert(assignmentsPayload);
      }
    }

    onSuccess();
    onClose();
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
        maxWidth: '700px', 
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
            {caseToEdit ? t('cases.modal.edit_title') : t('cases.modal.new_title')}
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
            {t('cases.modal.subtitle')}
          </p>
        </div>
        
        {error && <div className="error-alert" style={{ marginBottom: '1.5rem' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              {t('cases.modal.section_details')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: isSecret ? 'hsla(var(--danger), 0.1)' : 'hsla(var(--text-muted), 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: isSecret ? '1px solid hsla(var(--danger), 0.3)' : '1px solid hsla(var(--text-muted), 0.1)' }}>
                <input type="checkbox" id="isSecret" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label htmlFor="isSecret" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: isSecret ? 'hsl(var(--danger))' : 'inherit', margin: 0 }}>
                  <Lock size={16} /> {t('cases.modal.field_secret')}
                </label>
              </div>

              <div className="input-group">
                <label className="input-label">{t('cases.modal.field_title')}</label>
                <input type="text" className="input-field" placeholder={t('cases.modal.placeholder_title')} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div className="input-group">
                <label className="input-label">{t('cases.modal.field_client')}</label>
                <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  <option value="">{t('cases.modal.select_client_prompt')}</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              
              <div className="input-group">
                <label className="input-label">{t('cases.modal.field_description')}</label>
                <textarea className="input-field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
          </section>

          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              {t('cases.modal.section_state')}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">{t('cases.modal.field_status')}</label>
                <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="open">{t('cases.status.open')}</option>
                  <option value="pending">{t('cases.status.pending')}</option>
                  <option value="closed">{t('cases.status.closed')}</option>
                  <option value="archived">{t('cases.status.archived')}</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{t('cases.modal.field_outcome')}</label>
                <select className="input-field" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  <option value="ongoing">{t('cases.outcome.ongoing')}</option>
                  <option value="won">{t('cases.outcome.won')}</option>
                  <option value="lost">{t('cases.outcome.lost')}</option>
                  <option value="settled">{t('cases.outcome.settled')}</option>
                  <option value="dismissed">{t('cases.outcome.dismissed')}</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{t('cases.modal.field_payment')}</label>
                <select className="input-field" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                  <option value="pending">{t('cases.payment.pending')}</option>
                  <option value="partial">{t('cases.payment.partial')}</option>
                  <option value="paid">{t('cases.payment.paid')}</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              {t('cases.modal.section_team')}
            </h4>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Users size={16} /> {t('cases.modal.team_help')}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', background: 'hsla(var(--text-muted), 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid hsla(var(--text-muted), 0.1)' }}>
                {firmUsers.length === 0 ? <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>{t('cases.modal.no_collaborators')}</span> : null}
                {firmUsers.map(user => (
                  <label key={user.id} style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', 
                    background: assignedUsers.includes(user.id) ? 'hsl(var(--primary))' : 'hsla(var(--text-muted), 0.1)', 
                    color: assignedUsers.includes(user.id) ? '#fff' : 'inherit',
                    padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-full)', 
                    cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.8rem', fontWeight: 500
                  }}>
                    <input 
                      type="checkbox" 
                      checked={assignedUsers.includes(user.id)} 
                      onChange={() => toggleUserAssignment(user.id)} 
                      style={{ display: 'none' }}
                    />
                    {assignedUsers.includes(user.id) && <X size={12} style={{ marginRight: -2 }} />}
                    {user.full_name} <span style={{ opacity: assignedUsers.includes(user.id) ? 0.8 : 0.5, fontSize: '0.7rem' }}>({t(`roles.${user.role}`)})</span>
                  </label>
                ))}
              </div>
              {isSecret && <p style={{ fontSize: '0.75rem', color: 'hsl(var(--danger))', marginTop: '0.75rem', fontWeight: 500 }}>{t('cases.modal.secret_warning')}</p>}
            </div>
          </section>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button type="button" onClick={onClose} className="btn" style={{ flex: 1 }}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? t('cases.modal.processing') : (caseToEdit ? t('cases.modal.update_btn') : t('cases.modal.create_btn'))}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};
