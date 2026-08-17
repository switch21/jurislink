import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Search, MessageSquare, Send, Lock, Users, FileText, Download, Archive, ChevronDown } from 'lucide-react';
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
  const [caseDocs, setCaseDocs] = useState<Record<string, any[]>>({});
  const [newNote, setNewNote] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const { profile, user } = useAuthStore();
  const navigate = useNavigate();

  // Closure/Archive workflow state
  const [closureModal, setClosureModal] = useState<{ caseId: string; outcome: string } | null>(null);
  const [archiveModal, setArchiveModal] = useState<string | null>(null);

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
        .neq('status', 'archived')
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
      console.error('Error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  // Check for closure reminders on load
  useEffect(() => {
    if (cases.length === 0) return;
    const now = new Date();
    const reminders = cases.filter(c => 
      c.next_closure_reminder && new Date(c.next_closure_reminder) <= now && c.status === 'open'
    );
    if (reminders.length > 0) {
      reminders.forEach(c => {
        setTimeout(() => {
          const shouldClose = window.confirm(
            `Rappel : Le dossier "${c.title}" (${c.outcome === 'won' ? 'Gagné' : 'Perdu'}) n'est pas encore clôturé.\nVoulez-vous le clôturer maintenant ?`
          );
          if (shouldClose) {
            handleClosureConfirm(c.id);
          } else {
            // Snooze 3 more days
            const nextReminder = new Date();
            nextReminder.setDate(nextReminder.getDate() + 3);
            supabase.from('cases').update({ next_closure_reminder: nextReminder.toISOString() }).eq('id', c.id).then(() => {});
          }
        }, 500);
      });
    }
  }, [cases]);

  const handleDelete = async (id: string) => {
    if (window.confirm(t('cases.delete_confirm'))) {
      await supabase.from('cases').delete().eq('id', id);
      fetchCases();
    }
  };

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

  // Quick inline update for status/outcome/payment
  const handleQuickUpdate = async (caseId: string, field: string, value: string) => {
    const updateData: any = { [field]: value };
    
    // If outcome changes to won/lost/settled/dismissed, trigger closure workflow
    if (field === 'outcome' && ['won', 'lost', 'settled', 'dismissed'].includes(value)) {
      setClosureModal({ caseId, outcome: value });
      // Still update the outcome immediately
      await supabase.from('cases').update(updateData).eq('id', caseId);
      fetchCases();
      return;
    }

    await supabase.from('cases').update(updateData).eq('id', caseId);
    fetchCases();
  };

  const handleClosureConfirm = async (caseId: string) => {
    // Close the case
    await supabase.from('cases').update({ 
      status: 'closed',
      next_closure_reminder: null 
    }).eq('id', caseId);
    setClosureModal(null);
    // Ask about archiving
    setArchiveModal(caseId);
  };

  const handleClosureDecline = async (caseId: string) => {
    // Set reminder in 3 days
    const nextReminder = new Date();
    nextReminder.setDate(nextReminder.getDate() + 3);
    await supabase.from('cases').update({ 
      next_closure_reminder: nextReminder.toISOString() 
    }).eq('id', caseId);
    setClosureModal(null);
    fetchCases();
  };

  const handleArchiveSchedule = async (caseId: string) => {
    // Set archivable_after to 1 month from now
    const archiveDate = new Date();
    archiveDate.setMonth(archiveDate.getMonth() + 1);
    await supabase.from('cases').update({ 
      archivable_after: archiveDate.toISOString() 
    }).eq('id', caseId);
    setArchiveModal(null);
    fetchCases();
  };

  const handleArchiveNow = async (caseId: string) => {
    await supabase.from('cases').update({ 
      status: 'archived',
      archivable_after: null 
    }).eq('id', caseId);
    fetchCases();
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

  const SelectBadge = ({ value, options, labels, colors, onChange }: { value: string; options: string[]; labels: Record<string, string>; colors: Record<string, string>; onChange: (val: string) => void }) => (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={value}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          padding: '0.15rem 1.2rem 0.15rem 0.5rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: `hsla(${colors[value] || 'var(--text-muted)'}, 0.1)`,
          color: `hsl(${colors[value] || 'var(--text-muted)'})`,
          border: `1px solid hsla(${colors[value] || 'var(--text-muted)'}, 0.3)`,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{labels[opt] || opt}</option>
        ))}
      </select>
      <ChevronDown size={10} style={{ position: 'absolute', right: '0.35rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: `hsl(${colors[value] || 'var(--text-muted)'})` }} />
    </div>
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
            const docsForCase = caseDocs[c.id] || [];
            const canArchive = c.status === 'closed' && c.archivable_after && new Date(c.archivable_after) <= new Date();
            
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
                      <SelectBadge
                        value={c.status}
                        options={['open', 'pending', 'closed']}
                        labels={statusLabels}
                        colors={statusColors}
                        onChange={(val) => handleQuickUpdate(c.id, 'status', val)}
                      />
                      <SelectBadge
                        value={c.outcome || 'ongoing'}
                        options={['ongoing', 'won', 'lost', 'settled', 'dismissed']}
                        labels={outcomeLabels}
                        colors={outcomeColors}
                        onChange={(val) => handleQuickUpdate(c.id, 'outcome', val)}
                      />
                      <SelectBadge
                        value={c.payment_status || 'pending'}
                        options={['pending', 'partial', 'paid']}
                        labels={payLabels}
                        colors={payColors}
                        onChange={(val) => handleQuickUpdate(c.id, 'payment_status', val)}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <MessageSquare size={14} /> {notes.length} {t('cases.notes')}
                      </span>
                      {c.assignments && c.assignments.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                          <Users size={14} /> {c.assignments.length} {t('cases.assigned')}
                        </span>
                      )}
                      {canArchive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchiveNow(c.id); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, background: 'hsla(var(--warning), 0.15)', color: 'hsl(var(--warning))', border: '1px solid hsla(var(--warning), 0.3)', cursor: 'pointer' }}
                        >
                          <Archive size={12} /> Archiver
                        </button>
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
                      <FileText size={16} /> Documents liés
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      {docsForCase.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Aucun document lié</p>
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
                              <Download size={14} /> <span className="hide-on-mobile">Télécharger</span>
                            </button>
                          </div>
                        ))
                      )}
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/documents?case=${c.id}`); }} className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        Gérer les documents
                      </button>
                    </div>

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

      {/* Closure confirmation modal */}
      {closureModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setClosureModal(null)}>
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ marginBottom: '1rem' }}>Clôturer le dossier ?</h4>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>
              L'issue du dossier a été mise à jour ({outcomeLabels[closureModal.outcome]}). Voulez-vous clôturer ce dossier maintenant ?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => handleClosureDecline(closureModal.caseId)}>
                Non, plus tard
              </button>
              <button className="btn btn-primary" onClick={() => handleClosureConfirm(closureModal.caseId)}>
                Oui, clôturer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive scheduling modal */}
      {archiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setArchiveModal(null); fetchCases(); }}>
          <div className="glass-card" style={{ padding: '2rem', maxWidth: '450px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ marginBottom: '1rem' }}>Archiver le dossier ?</h4>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', marginBottom: '1.5rem' }}>
              Le dossier a été clôturé. Souhaitez-vous planifier son archivage ? Un bouton "Archiver" apparaîtra automatiquement dans 1 mois.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setArchiveModal(null); fetchCases(); }}>
                Non merci
              </button>
              <button className="btn btn-primary" onClick={() => handleArchiveSchedule(archiveModal)}>
                Oui, planifier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
