import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Search, MessageSquare, Send, Lock, Users, FileText } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { CaseModal } from '../../components/firm/CaseModal';
import { useNavigate } from 'react-router-dom';

export const CasesList = () => {
  const { t, i18n } = useTranslation();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [caseNotes, setCaseNotes] = useState<Record<string, any[]>>({});
  const [newNote, setNewNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const { profile, user } = useAuthStore();
  const navigate = useNavigate();

  const fetchCases = React.useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from('cases')
        .select('*, client:clients(full_name), assignments:case_assignments(user:users(full_name))')
        .eq('tenant_id', profile?.tenant_id)
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
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleDelete = async (id: string) => {
    if (window.confirm(t('cases.delete_confirm'))) {
      await supabase.from('cases').delete().eq('id', id);
      fetchCases();
    }
  };

  const handleAddNote = async (caseId: string) => {
    if (!newNote.trim()) return;
    setNoteLoading(true);
    const { error } = await supabase.from('case_notes').insert({
      tenant_id: profile?.tenant_id,
      case_id: caseId,
      author_id: user?.id,
      content: newNote
    });
    if (!error) {
      setNewNote('');
      fetchCases();
    }
    setNoteLoading(false);
  };

  const statusLabels: Record<string, string> = { 
    open: t('cases.status.open'), 
    closed: t('cases.status.closed'), 
    pending: t('cases.status.pending'), 
    archived: t('cases.status.archived') 
  };
  const statusColors: Record<string, string> = { open: 'var(--primary)', closed: 'var(--success)', pending: 'var(--warning)', archived: 'var(--text-muted)' };
  
  const outcomeLabels: Record<string, string> = { 
    ongoing: t('cases.outcome.ongoing'), 
    won: t('cases.outcome.won'), 
    lost: t('cases.outcome.lost'), 
    settled: t('cases.outcome.settled'), 
    dismissed: t('cases.outcome.dismissed') 
  };
  const outcomeColors: Record<string, string> = { ongoing: 'var(--primary)', won: 'var(--success)', lost: 'var(--danger)', settled: 'var(--warning)', dismissed: 'var(--text-muted)' };
  
  const payLabels: Record<string, string> = { 
    pending: t('cases.payment.pending'), 
    partial: t('cases.payment.partial'), 
    paid: t('cases.payment.paid') 
  };
  const payColors: Record<string, string> = { pending: 'var(--warning)', partial: 'var(--primary)', paid: 'var(--success)' };

  const filtered = cases.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  const Badge = ({ label, color }: { label: string; color: string }) => (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: `hsla(${color}, 0.1)`, color: `hsl(${color})` }}>{label}</span>
  );

  const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>{t('cases.title')}</h3>
        <button className="btn btn-primary" onClick={() => { setEditingCase(null); setIsModalOpen(true); }}><Plus size={18} /> {t('cases.new_case')}</button>
      </div>
      
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input type="text" className="input-field" placeholder={t('cases.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '3rem', width: '100%', boxSizing: 'border-box' }} />
      </div>

      {loading ? <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.length === 0 && <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>{t('common.no_data')}</div>}
          {filtered.map(c => {
            const isExpanded = expandedId === c.id;
            const notes = caseNotes[c.id] || [];
            
            return (
              <div key={c.id} className="glass-card" style={{ padding: '1.25rem', transition: 'var(--transition)', borderLeft: c.is_secret ? '3px solid hsl(var(--danger))' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {c.is_secret && <Lock size={16} color="hsl(var(--danger))" title={t('cases.secret')} />} 
                      {c.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '0.75rem' }}>
                      {t('cases.client')}: {c.client?.full_name || '-'} • {t('cases.created_on')} {new Date(c.created_at).toLocaleDateString(locale)}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge label={statusLabels[c.status] || c.status} color={statusColors[c.status] || 'var(--text-muted)'} />
                      <Badge label={outcomeLabels[c.outcome] || c.outcome || '-'} color={outcomeColors[c.outcome] || 'var(--text-muted)'} />
                      <Badge label={payLabels[c.payment_status] || c.payment_status || '-'} color={payColors[c.payment_status] || 'var(--text-muted)'} />
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <MessageSquare size={14} /> {notes.length} {t('cases.notes')}
                      </span>
                      {c.assignments && c.assignments.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                          <Users size={14} /> {c.assignments.length} {t('cases.assigned')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button onClick={() => navigate(`/dashboard/documents?case=${c.id}`)} style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }} title="Voir les documents">
                      <FileText size={16} /> <span className="hide-on-mobile">Documents</span>
                    </button>
                    <button onClick={() => { setEditingCase(c); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '0.5rem' }} title={t('common.edit')}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer', padding: '0.5rem' }} title={t('common.delete')}><Trash2 size={18} /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid hsla(var(--text-muted), 0.1)' }}>
                    <h5 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MessageSquare size={16} /> {t('cases.annotations')}
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {notes.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>{t('cases.no_notes')}</p>
                      ) : (
                        notes.map(n => (
                          <div key={n.id} style={{ background: 'hsla(var(--text-muted), 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{n.author?.full_name || t('roles.user', 'Utilisateur')}</span>
                              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
                                {new Date(n.created_at).toLocaleDateString(locale)} {new Date(n.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{n.content}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder={t('cases.add_annotation')} 
                        value={newNote} 
                        onChange={(e) => setNewNote(e.target.value)} 
                        onKeyPress={(e) => e.key === 'Enter' && handleAddNote(c.id)}
                        style={{ flex: 1, marginBottom: 0 }} 
                      />
                      <button className="btn btn-primary" onClick={() => handleAddNote(c.id)} disabled={noteLoading || !newNote.trim()}>
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {isModalOpen && <CaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} caseToEdit={editingCase} onSuccess={fetchCases} />}
    </div>
  );
};
