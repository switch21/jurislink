import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { X, Lock, Users } from 'lucide-react';

interface CaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseToEdit: any;
  onSuccess: () => void;
}

export const CaseModal: React.FC<CaseModalProps> = ({ isOpen, onClose, caseToEdit, onSuccess }) => {
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
        // Fetch clients
        supabase.from('clients').select('id, full_name')
          .eq('tenant_id', profile.tenant_id).order('full_name')
          .then(({ data }) => { if (data) setClients(data); });

        // Fetch team members
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

        // Fetch existing assignments
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
    if (!clientId) { setError('Veuillez sélectionner un client'); setLoading(false); return; }

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

    // Handle assignments
    if (savedCaseId) {
      // 1. Delete all existing assignments
      await supabase.from('case_assignments').delete().eq('case_id', savedCaseId);
      
      // 2. Insert new assignments
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
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '600px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><X size={24} /></button>
        <h2 style={{ marginBottom: '1.5rem' }}>{caseToEdit ? 'Modifier Dossier' : 'Nouveau Dossier'}</h2>
        
        {error && <div className="error-alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: isSecret ? 'hsla(var(--danger), 0.1)' : 'hsla(var(--text-muted), 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: isSecret ? '1px solid hsla(var(--danger), 0.3)' : '1px solid transparent' }}>
            <input type="checkbox" id="isSecret" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <label htmlFor="isSecret" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, color: isSecret ? 'hsl(var(--danger))' : 'inherit', margin: 0 }}>
              <Lock size={16} /> Dossier Confidentiel (Restreint)
            </label>
          </div>

          <div className="input-group">
            <label className="input-label">Titre du dossier *</label>
            <input type="text" className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input-field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          
          <div className="input-group">
            <label className="input-label">Client *</label>
            <select className="input-field" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="">-- Sélectionner un client --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Statut</label>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Ouvert</option>
                <option value="pending">En attente</option>
                <option value="closed">Clôturé</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Résultat</label>
              <select className="input-field" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="ongoing">En cours</option>
                <option value="won">Gagné</option>
                <option value="lost">Perdu</option>
                <option value="settled">Réglé</option>
                <option value="dismissed">Classé</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Paiement</label>
              <select className="input-field" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                <option value="pending">En attente</option>
                <option value="partial">Partiel</option>
                <option value="paid">Payé</option>
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginTop: '0.5rem' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} /> Collaborateurs Assignés
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid hsla(var(--text-muted), 0.2)' }}>
              {firmUsers.length === 0 ? <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Aucun collaborateur trouvé</span> : null}
              {firmUsers.map(user => (
                <label key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: assignedUsers.includes(user.id) ? 'hsla(var(--primary), 0.1)' : 'transparent', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: assignedUsers.includes(user.id) ? '1px solid hsla(var(--primary), 0.3)' : '1px solid transparent', transition: 'var(--transition)' }}>
                  <input 
                    type="checkbox" 
                    checked={assignedUsers.includes(user.id)} 
                    onChange={() => toggleUserAssignment(user.id)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: assignedUsers.includes(user.id) ? 600 : 400, color: assignedUsers.includes(user.id) ? 'hsl(var(--primary))' : 'inherit' }}>
                    {user.full_name} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>({user.role})</span>
                  </span>
                </label>
              ))}
            </div>
            {isSecret && <p style={{ fontSize: '0.75rem', color: 'hsl(var(--danger))', marginTop: '0.5rem' }}>Attention : ce dossier étant secret, seuls les administrateurs et les collaborateurs cochés ci-dessus pourront le voir.</p>}
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};
