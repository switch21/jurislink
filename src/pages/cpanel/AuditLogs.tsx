import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { History, Search } from 'lucide-react';

export const AuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, user:users(full_name, email), tenant:tenants(name)')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (data) setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tenant?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction ? log.action === filterAction : true;
    
    return matchesSearch && matchesAction;
  });

  const actions = Array.from(new Set(logs.map(l => l.action))).filter(Boolean);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo-container-small" style={{ background: 'hsla(var(--primary), 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
            <History size={24} />
          </div>
          <h3>Journal d'audit</h3>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem' }}>
          <div className="input-with-icon">
            <Search className="input-icon" size={18} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Rechercher par action, entité, utilisateur ou cabinet..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <select 
              className="input-field" 
              value={filterAction} 
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">Toutes les actions</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'hsla(var(--text-muted), 0.03)', borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <th style={{ padding: '1rem' }}>Date</th>
                  <th style={{ padding: '1rem' }}>Cabinet</th>
                  <th style={{ padding: '1rem' }}>Utilisateur</th>
                  <th style={{ padding: '1rem' }}>Action</th>
                  <th style={{ padding: '1rem' }}>Entité</th>
                  <th style={{ padding: '1rem' }}>Détails</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.05)' }}>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontWeight: 500 }}>{log.tenant?.name || 'Système'}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{log.user?.full_name || 'Inconnu'}</span>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{log.user?.email}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: log.action === 'DELETE' ? 'hsla(var(--danger), 0.1)' : 
                                   log.action === 'INSERT' ? 'hsla(var(--success), 0.1)' : 'hsla(var(--primary), 0.1)',
                        color: log.action === 'DELETE' ? 'hsl(var(--danger))' : 
                               log.action === 'INSERT' ? 'hsl(var(--success))' : 'hsl(var(--primary))'
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'hsl(var(--text-muted))' }}>
                      {log.entity}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                      {log.new_state ? (
                        <details>
                          <summary style={{ cursor: 'pointer', color: 'hsl(var(--primary))' }}>Voir data</summary>
                          <pre style={{ 
                            marginTop: '0.5rem', 
                            padding: '0.5rem', 
                            background: 'hsla(var(--text-muted), 0.05)', 
                            borderRadius: 'var(--radius-sm)',
                            maxWidth: '300px',
                            overflow: 'auto'
                          }}>
                            {JSON.stringify(log.new_state, null, 2)}
                          </pre>
                        </details>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                      Aucun log trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
