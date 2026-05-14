import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';

interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: any;
  onSuccess: () => void;
}

export const TenantModal: React.FC<TenantModalProps> = ({ isOpen, onClose, tenant, onSuccess }) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('fr');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setLanguage(tenant.language);
    } else {
      setName('');
      setLanguage('fr');
    }
  }, [tenant]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (tenant) {
      await supabase.from('tenants').update({ name, language }).eq('id', tenant.id);
    } else {
      await supabase.from('tenants').insert({ name, language });
    }
    
    setLoading(false);
    onSuccess();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        <h2 style={{ marginBottom: '1.5rem' }}>{tenant ? 'Modifier le Cabinet' : 'Nouveau Cabinet'}</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Nom du Cabinet</label>
            <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Langue par défaut</label>
            <select className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
              <option value="es">Espagnol</option>
              <option value="it">Italien</option>
              <option value="de">Allemand</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};
