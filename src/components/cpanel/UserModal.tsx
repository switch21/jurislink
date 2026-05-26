import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { Portal } from '../common/Portal';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: any;
  onSuccess: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userToEdit, onSuccess }) => {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('lawyer');
  const [tenantId, setTenantId] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRoot = profile?.role === 'root_admin';

  useEffect(() => {
    if (isRoot) {
      supabase.from('tenants').select('id, name').then(({ data }) => {
        if (data) setTenants(data);
      });
    }

    if (userToEdit) {
      setFullName(userToEdit.full_name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
      setTenantId(userToEdit.tenant_id || '');
    } else {
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('lawyer');
      setTenantId(profile?.tenant_id || '');
    }
  }, [userToEdit, profile, isRoot]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (userToEdit) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: fullName, role, tenant_id: tenantId || null })
        .eq('id', userToEdit.id);
      
      if (updateError) setError(updateError.message);
      else {
        onSuccess();
        onClose();
      }
    } else {
      try {
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { 
            email, 
            password, 
            full_name: fullName, 
            role, 
            tenant_id: tenantId || null 
          }
        });

        if (error) {
          setError(error.message || t('users.modal.error_create'));
        } else {
          onSuccess();
          onClose();
        }
      } catch (err: any) {
        setError(err.message || t('users.modal.error_network'));
      }
    }
    
    setLoading(false);
  };

  return (
    <Portal>
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000,
      overflowY: 'auto', padding: '2rem 1rem'
    }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        <h2 style={{ marginBottom: '1.5rem' }}>{userToEdit ? t('users.modal.edit_title') : t('users.modal.new_title')}</h2>
        
        {error && <div className="error-alert" style={{marginBottom: '1rem'}}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">{t('users.modal.field_name')}</label>
            <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          
          <div className="input-group">
            <label className="input-label">{t('users.modal.field_email')}</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!userToEdit} />
          </div>

          {!userToEdit && (
            <div className="input-group">
              <label className="input-label">{t('users.modal.field_password')}</label>
              <input type="text" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          )}

          {isRoot && (
            <div className="input-group">
              <label className="input-label">{t('users.modal.field_tenant')}</label>
              <select className="input-field" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">{t('users.modal.tenant_none')}</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">{t('users.modal.field_role')}</label>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
              {isRoot && <option value="root_admin">{t('roles.root_admin')}</option>}
              {isRoot && <option value="firm_admin">{t('roles.firm_admin')}</option>}
              {!isRoot && <option value="firm_admin">{t('roles.firm_admin_simple')}</option>}
              <option value="lawyer">{t('roles.lawyer')}</option>
              <option value="secretary">{t('roles.secretary')}</option>
              <option value="client">{t('roles.client')}</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? t('users.modal.saving') : t('users.modal.save')}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
};
