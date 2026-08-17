import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Lock, Users, FileText, Download, MessageSquare, Archive } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';

export const ArchivesList = () => {
  const { t, i18n } = useTranslation();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [caseNotes, setCaseNotes] = useState<Record<string, any[]>>({});
  const [caseDocs, setCaseDocs] = useState<Record<string, any[]>>({});
  const { profile } = useAuthStore();

  const fetchArchived = React.useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from('cases')
        .select('*, client:clients(full_name), assignments:case_assignments(user:users(full_name))')
        .eq('tenant_id', profile?.tenant_id)
        .eq('status', 'archived')
        .order('created_at', { ascending: false });
      if (data) setCases(data);

      const { data: notes } = await supabase.from('case_notes')
        .select('*, author:users(full_name)')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: true });
      
      if (notes) {
        const grouped: Record<string, any[]> = {};
        notes.forEach(n => { if (!grouped[n.case_id]) grouped[n.case_id] = []; grouped[n.case_id].push(n); });
        setCaseNotes(grouped);
      }

      const { data: docs } = await supabase.from('documents')
        .select('*, uploader:users(full_name)')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });

      if (docs) {
        const groupedDocs: Record<string, any[]> = {};
        docs.forEach(d => { if (!groupedDocs[d.case_id]) groupedDocs[d.case_id] = []; groupedDocs[d.case_id].push(d); });
        setCaseDocs(groupedDocs);
      }
    } catch (err) {
      console.error('Error fetching archived cases:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const handleDownloadDoc = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Erreur lors du téléchargement');
    }
  };

  const statusLabels: Record<string, string> = { open: 'Ouvert', closed: 'Clôturé', pending: 'En attente', archived: 'Archivé' };
  const outcomeLabels: Record<string, string> = { ongoing: 'En cours', won: 'Gagné', lost: 'Perdu', settled: 'Réglé', dismissed: 'Rejeté' };
  const payLabels: Record<string, string> = { pending: 'Non payé', partial: 'Partiel', paid: 'Payé' };

  const statusColors: Record<string, string> = { open: 'var(--primary)', closed: 'var(--success)', pending: 'var(--warning)', archived: 'var(--text-muted)' };
  const outcomeColors: Record<string, string> = { ongoing: 'var(--primary)', won: 'var(--success)', lost: 'var(--danger)', settled: 'var(--warning)', dismissed: 'var(--text-muted)' };
  const payColors: Record<string, string> = { pending: 'var(--warning)', partial: 'var(--primary)', paid: 'var(--success)' };

  const Badge = ({ label, color }: { label: string; color: string }) => (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: `hsla(${color}, 0.1)`, color: `hsl(${color})` }}>{label}</span>
  );

  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
  const filtered = cases.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Archive size={24} style={{ color: 'hsl(var(--text-muted))' }} />
          <h3>Archives</h3>
        </div>
        <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
          {filtered.length} dossier{filtered.length > 1 ? 's' : ''} archivé{filtered.length > 1 ? 's' : ''}
        </span>
      </div>
      
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input type="text" className="input-field" placeholder="Rechercher dans les archives..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '3rem', width: '100%', boxSizing: 'border-box' }} />
      </div>

      {loading ? <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.length === 0 && <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun dossier archivé</div>}
          {filtered.map(c => {
            const isExpanded = expandedId === c.id;
            const notes = caseNotes[c.id] || [];
            const docsForCase = caseDocs[c.id] || [];
            
            return (
              <div key={c.id} className="glass-card" style={{ padding: '1.25rem', transition: 'var(--transition)', opacity: 0.85, borderLeft: c.is_secret ? '3px solid hsl(var(--danger))' : '3px solid hsl(var(--text-muted))' }}>
                <div style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {c.is_secret && <Lock size={16} color="hsl(var(--danger))" />}
                    <Archive size={16} color="hsl(var(--text-muted))" />
                    {c.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '0.75rem' }}>
                    Client: {c.client?.full_name || '-'} • Créé le {new Date(c.created_at).toLocaleDateString(locale)}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge label={statusLabels[c.status] || c.status} color={statusColors[c.status] || 'var(--text-muted)'} />
                    <Badge label={outcomeLabels[c.outcome] || c.outcome || '-'} color={outcomeColors[c.outcome] || 'var(--text-muted)'} />
                    <Badge label={payLabels[c.payment_status] || c.payment_status || '-'} color={payColors[c.payment_status] || 'var(--text-muted)'} />
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                      <MessageSquare size={14} /> {notes.length} notes
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FileText size={14} /> {docsForCase.length} documents
                    </span>
                    {c.assignments && c.assignments.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Users size={14} /> {c.assignments.length} assigné{c.assignments.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid hsla(var(--text-muted), 0.1)' }}>
                    {/* Documents section */}
                    <h5 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} /> Documents liés
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      {docsForCase.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Aucun document</p>
                      ) : (
                        docsForCase.map(d => (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'hsla(var(--text-muted), 0.05)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <FileText size={16} style={{ color: 'hsl(var(--primary))' }} />
                              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{d.file_name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                                ({(d.file_size / 1024).toFixed(1)} Ko)
                              </span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDownloadDoc(d.file_path, d.file_name); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                              <Download size={14} /> Télécharger
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Notes section - read only */}
                    <h5 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MessageSquare size={16} /> Annotations
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {notes.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Aucune annotation</p>
                      ) : (
                        notes.map(n => (
                          <div key={n.id} style={{ background: 'hsla(var(--text-muted), 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{n.author?.full_name || 'Utilisateur'}</span>
                              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
                                {new Date(n.created_at).toLocaleDateString(locale)} {new Date(n.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{n.content}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic', marginTop: '1rem', textAlign: 'center' }}>
                      Ce dossier est archivé et ne peut pas être modifié.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
