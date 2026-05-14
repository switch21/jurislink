import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Search, MessageSquare, Send, Lock, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { CaseModal } from '../../components/firm/CaseModal';

export const CasesList = () => {
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
    if (window.confirm("Supprimer ce dossier ?")) {
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

  const statusLabels: Record<string, string> = { open: 'Ouvert', closed: 'Clôturé', pending: 'En attente', archived: 'Archivé' };
  const statusColors: Record<string, string> = { open: 'var(--primary)', closed: 'var(--success)', pending: 'var(--warning)', archived: 'var(--text-muted)' };
  const outcomeLabels: Record<string, string> = { ongoing: 'En cours', won: 'Gagné', lost: 'Perdu', settled: 'Réglé', dismissed: 'Classé' };
  const outcomeColors: Record<string, string> = { ongoing: 'var(--primary)', won: 'var(--success)', lost: 'var(--danger)', settled: 'var(--warning)', dismissed: 'var(--text-muted)' };
  const payLabels: Record<string, string> = { pending: 'En attente', partial: 'Partiel', paid: 'Payé' };
  const payColors: Record<string, string> = { pending: 'var(--warning)', partial: 'var(--primary)', paid: 'var(--success)' };

  const filtered = cases.filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()));

  const Badge = ({ label, color }: { label: string; color: string }) => (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', background: `hsla(${color}, 0.1)`, color: `hsl(${color})` }}>{label}</span>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Gestion des Dossiers</h3>
        <button className="btn btn-primary" onClick={() => { setEditingCase(null); setIsModalOpen(true); }}><Plus size={18} /> Nouveau Dossier</button>
      </div>
      
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
        <input type="text" className="input-field" placeholder="Rechercher un dossier..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '3rem', width: '100%', boxSizing: 'border-box' }} />
      </div>

      {loading ? <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.length === 0 && <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun dossier trouvé</div>}
          {filtered.map(c => {
            const isExpanded = expandedId === c.id;
            const notes = caseNotes[c.id] || [];
            
            return (
              <div key={c.id} className="glass-card" style={{ padding: '1.25rem', transition: 'var(--transition)', borderLeft: c.is_secret ? '3px solid hsl(var(--danger))' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {c.is_secret && <Lock size={16} color="hsl(var(--danger))" />} 
                      {c.title}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginBottom: '0.75rem' }}>Client: {c.client?.full_name || '-'} • Créé le {new Date(c.created_at).toLocaleDateString('fr-FR')}</div>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge label={statusLabels[c.status] || c.status} color={statusColors[c.status] || 'var(--text-muted)'} />
                      <Badge label={outcomeLabels[c.outcome] || c.outcome || '-'} color={outcomeColors[c.outcome] || 'var(--text-muted)'} />
                      <Badge label={payLabels[c.payment_status] || c.payment_status || '-'} color={payColors[c.payment_status] || 'var(--text-muted)'} />
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <MessageSquare size={14} /> {notes.length} note{notes.length !== 1 ? 's' : ''}
                      </span>
                      {c.assignments && c.assignments.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                          <Users size={14} /> {c.assignments.length} assigné{c.assignments.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <button onClick={() => { setEditingCase(c); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '0.5rem' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer', padding: '0.5rem' }}><Trash2 size={18} /></button>
                  </div>
                </div>

                {/* Expanded Notes Section */}
                {isExpanded && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid hsla(var(--text-muted), 0.1)' }}>
                    <h5 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MessageSquare size={16} /> Annotations du dossier
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {notes.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Aucune note pour le moment.</p>
                      ) : (
                        notes.map(n => (
                          <div key={n.id} style={{ background: 'hsla(var(--text-muted), 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{n.author?.full_name || 'Utilisateur'}</span>
                              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
                                {new Date(n.created_at).toLocaleDateString('fr-FR')} {new Date(n.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
                        placeholder="Ajouter une annotation..." 
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
