import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Filter, Clock, Search, FileText, Users, FolderOpen, CreditCard, Briefcase } from 'lucide-react';

export const EventHistory = () => {
  const { profile } = useAuthStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);

    const isLawyer = profile?.role === 'lawyer';
    let assignedCaseIds: string[] = [];

    if (isLawyer) {
      const { data: assignments } = await supabase
        .from('case_assignments')
        .select('case_id')
        .eq('user_id', profile.id);
      assignedCaseIds = assignments?.map(a => a.case_id) || [];
    }
    
    let query = supabase.from('audit_logs')
      .select('*, user:users(full_name, email)')
      .eq('tenant_id', profile.tenant_id)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (filterEntity) query = query.eq('entity', filterEntity);
    if (filterAction) query = query.eq('action', filterAction);

    const { data } = await query;
    let filtered = data || [];

    if (isLawyer) {
      // For lawyers, show their own actions OR actions on their assigned cases
      filtered = filtered.filter(log => {
        const isMyAction = log.user_id === profile.id;
        const isMyCase = log.entity === 'cases' && assignedCaseIds.includes(log.entity_id);
        // For other entities like documents/invoices, we don't have the case_id in the log entry easily
        // So we show their own actions and case modifications for their cases
        return isMyAction || isMyCase;
      });
    }

    setLogs(filtered);
    setLoading(false);
  }, [profile?.id, profile?.tenant_id, profile?.role, filterEntity, filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const entityIcons: Record<string, React.ReactNode> = {
    cases: <FolderOpen size={16} />,
    clients: <Briefcase size={16} />,
    documents: <FileText size={16} />,
    invoices: <CreditCard size={16} />,
    users: <Users size={16} />,
    events: <Clock size={16} />
  };

  const actionLabels: Record<string, string> = {
    INSERT: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression'
  };

  const entityLabels: Record<string, string> = {
    cases: 'Dossier',
    clients: 'Client',
    documents: 'Document',
    invoices: 'Facture',
    users: 'Membre équipe',
    events: 'Événement',
    tenants: 'Cabinet'
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3><Clock size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Historique du Cabinet</h3>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Type d'élément</label>
            <select className="input-field" value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
              <option value="">Tous</option>
              {Object.entries(entityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Action</label>
            <select className="input-field" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">Toutes</option>
              <option value="INSERT">Création</option>
              <option value="UPDATE">Modification</option>
              <option value="DELETE">Suppression</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <Clock size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>Aucun historique disponible pour le moment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                padding: '1rem', 
                borderBottom: '1px solid hsla(var(--text-muted), 0.05)',
                fontSize: '0.9rem'
              }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: 'var(--radius-sm)', 
                  background: log.action === 'DELETE' ? 'hsla(var(--danger), 0.1)' : 
                              log.action === 'INSERT' ? 'hsla(var(--success), 0.1)' : 'hsla(var(--primary), 0.1)',
                  color: log.action === 'DELETE' ? 'hsl(var(--danger))' : 
                         log.action === 'INSERT' ? 'hsl(var(--success))' : 'hsl(var(--primary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {entityIcons[log.entity] || <Clock size={16} />}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {actionLabels[log.action]} d'un {entityLabels[log.entity] || log.entity}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                    Par <strong>{log.user?.full_name || 'Système'}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 500 }}>{new Date(log.timestamp).toLocaleDateString('fr-FR')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
