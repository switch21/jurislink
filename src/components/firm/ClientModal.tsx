import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { X } from 'lucide-react';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit: any;
  onSuccess: () => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, clientToEdit, onSuccess }) => {
  const { profile } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clientToEdit) {
      setFullName(clientToEdit.full_name || '');
      setCompany(clientToEdit.company || '');
      setPhone(clientToEdit.phone || '');
      setEmail(clientToEdit.email || '');
      setAddress(clientToEdit.address || '');
      setNotes(clientToEdit.notes || '');
    } else {
      setFullName(''); setCompany(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    }
    setError('');
  }, [clientToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      full_name: fullName, company, phone, email, address, notes,
      tenant_id: profile?.tenant_id
    };

    if (clientToEdit) {
      const { tenant_id, ...updatePayload } = payload;
      const { error: err } = await supabase.from('clients').update(updatePayload).eq('id', clientToEdit.id);
      if (err) setError(err.message);
      else { onSuccess(); onClose(); }
    } else {
      const { error: err } = await supabase.from('clients').insert(payload);
      if (err) setError(err.message);
      else { onSuccess(); onClose(); }
    }
    setLoading(false);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '550px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><X size={24} /></button>
        <h2 style={{ marginBottom: '1.5rem' }}>{clientToEdit ? 'Modifier Client' : 'Nouveau Client'}</h2>
        {error && <div className="error-alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Nom Complet *</label>
            <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Société</label>
            <input type="text" className="input-field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nom de la société" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Téléphone</label>
              <input type="tel" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" />
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Adresse</label>
            <input type="text" className="input-field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse complète" />
          </div>
          <div className="input-group">
            <label className="input-label">Notes</label>
            <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};
