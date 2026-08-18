// ============================================================================
// JurisLink - Phase 3.9 - Patch TenantModal.tsx (audit log via helper)
// ============================================================================
// Changements vs version Phase 2:
//   1. Import { logAudit } from '../../lib/audit'.
//   2. Après insert/update réussi d'un tenant, appel logAudit avec:
//      - action: TENANT_CREATE ou TENANT_UPDATE
//      - entity: 'tenants'
//      - entity_id: tenant.id (update) ou inserted.id (create)
//      - new_state: tenantData
//      - previous_state: tenant (update) ou null (create)
//      - metadata: { source: 'UI:TenantModal', plan }
//   3. Pour le CREATE, on enchaîne .insert(tenantData).select('id').single()
//      pour récupérer l'ID du tenant créé et l'inclure dans audit_logs.
// Le reste de l'UI est préservé à l'identique (glass-card, sections, etc.).
// ============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';
import { Portal } from '../common/Portal';
import { logAudit } from '../../lib/audit';

interface TenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: any;
  onSuccess: () => void;
}

export const TenantModal: React.FC<TenantModalProps> = ({ isOpen, onClose, tenant, onSuccess }) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('fr');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [niu, setNiu] = useState('');
  const [plan, setPlan] = useState('starter');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || '');
      setLanguage(tenant.language || 'fr');
      setPhone(tenant.phone || '');
      setEmail(tenant.email || '');
      setAddress(tenant.address || '');
      setNiu(tenant.niu || '');
      setPlan(tenant.plan || 'starter');
      setLogoUrl(tenant.logo_url || '');
    } else {
      setName('');
      setLanguage('fr');
      setPhone('');
      setEmail('');
      setAddress('');
      setNiu('');
      setPlan('starter');
      setLogoUrl('');
    }
  }, [tenant]);

  if (!isOpen) return null;

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPlan = e.target.value;
    if (selectedPlan === 'enterprise') {
      alert("Contactez notre service commercial.");
      return;
    }
    setPlan(selectedPlan);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `logos/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, logoFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
        finalLogoUrl = publicUrl;
      }

      // Determine limits based on plan
      const maxUsers = plan === 'premium' ? 10 : 3;
      const maxStorage = plan === 'premium' ? 20 : 5;

      const tenantData = {
        name,
        language,
        phone,
        email,
        address,
        niu,
        plan,
        logo_url: finalLogoUrl,
        max_users: maxUsers,
        max_storage_gb: maxStorage
      };

      if (tenant) {
        // UPDATE
        const { error } = await supabase.from('tenants').update(tenantData).eq('id', tenant.id);
        if (error) throw error;

        // Audit log UPDATE (Phase 3.9)
        await logAudit({
          action: 'TENANT_UPDATE',
          entity: 'tenants',
          entity_id: tenant.id,
          previous_state: tenant,
          new_state: tenantData,
          metadata: {
            source: 'UI:TenantModal',
            plan,
          },
        });
      } else {
        // CREATE — on récupère l'ID via .select('id').single() pour l'audit
        const { data: inserted, error } = await supabase.from('tenants')
          .insert(tenantData)
          .select('id')
          .single();

        if (error) throw error;

        // Audit log CREATE (Phase 3.9)
        await logAudit({
          action: 'TENANT_CREATE',
          entity: 'tenants',
          entity_id: inserted?.id ?? 'unknown',
          new_state: { ...tenantData, id: inserted?.id },
          metadata: {
            source: 'UI:TenantModal',
            plan,
          },
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s'
        }} className="hover-scale">
          <X size={20} />
        </button>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(var(--primary))' }}>
            {tenant ? 'Modifier le Cabinet' : 'Nouveau Cabinet'}
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
            Configurez les paramètres et les limites du cabinet JurisLink.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Section: Informations Générales */}
          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              Informations Générales
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Nom du Cabinet</label>
                <input type="text" className="input-field" placeholder="Ex: Cabinet Dupont & Associés" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">NIU (Identifiant Unique)</label>
                <input type="text" className="input-field" placeholder="Numéro d'Identifiant Unique" value={niu} onChange={(e) => setNiu(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Langue par défaut</label>
                <select className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="sw">Kiswahili</option>
                  <option value="ar">العربية (Arabic)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Section: Contact & Localisation */}
          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              Contact & Localisation
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Email Professionnel</label>
                <input type="email" className="input-field" placeholder="contact@cabinet.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Téléphone</label>
                <input type="text" className="input-field" placeholder="+237 ..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Adresse Physique</label>
                <input type="text" className="input-field" placeholder="Rue, Ville, Pays" value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>
            </div>
          </section>

          {/* Section: Abonnement & Identité */}
          <section>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))', marginBottom: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', paddingBottom: '0.5rem' }}>
              Abonnement & Identité visuelle
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="input-group">
                <label className="input-label">Plan de souscription</label>
                <select className="input-field" value={plan} onChange={handlePlanChange} style={{ fontWeight: 600 }}>
                  <option value="starter">Starter (100€ / an)</option>
                  <option value="premium">Premium (535€ / an)</option>
                  <option value="enterprise">Enterprise (Sur devis)</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Logo du cabinet</label>
                <input type="file" className="input-field" accept="image/*" onChange={handleLogoChange} />
              </div>

              {(logoUrl || logoFile) && (
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'hsla(var(--text-muted), 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid hsla(var(--text-muted), 0.2)' }}>
                    <img src={logoFile ? URL.createObjectURL(logoFile) : logoUrl} alt="Logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Aperçu du logo</div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Sera affiché sur le tableau de bord et les documents.</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button type="button" onClick={onClose} className="btn" style={{ flex: 1 }}>Annuler</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? 'Traitement en cours...' : (tenant ? 'Mettre à jour' : 'Créer le cabinet')}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};
