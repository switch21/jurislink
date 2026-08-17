import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, FileText, Download, ChevronDown, ChevronRight, FolderOpen, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DocumentModal } from '../../components/firm/DocumentModal';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface GroupedClient {
  clientName: string;
  cases: {
    caseId: string;
    caseTitle: string;
    docs: any[];
  }[];
}

export const DocumentsList = () => {
  const { profile } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = searchParams.get('case');
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  const fetchDocs = React.useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase.from('documents')
        .select('*, uploader:users(full_name), case:cases(title, client_id, client:clients(full_name))')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });
      
      if (caseId) {
        query = query.eq('case_id', caseId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) {
        setDocs(data);
        // Auto-expand all groups when first loaded
        if (!caseId) {
          const clientNames = new Set<string>();
          const caseIds = new Set<string>();
          data.forEach(d => {
            const clientName = d.case?.client?.full_name || 'Autres documents';
            clientNames.add(clientName);
            if (d.case_id) caseIds.add(d.case_id);
          });
          setExpandedClients(clientNames);
          setExpandedCases(caseIds);
        }
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { 
    fetchDocs(); 
  }, [fetchDocs, caseId]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Supprimer ce document ?")) {
      await supabase.from('documents').delete().eq('id', id);
      fetchDocs();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / 1048576).toFixed(1) + ' Mo';
  };

  const handleDownload = async (path: string, name: string) => {
    try {
      if (!path) return;
      if (path.startsWith('http')) {
        window.open(path, '_blank');
        return;
      }
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Erreur lors du téléchargement:", err);
      alert("Impossible de télécharger le document.");
    }
  };

  const totalStorage = docs.reduce((acc, d) => acc + (d.file_size || 0), 0);
  const maxStorageGb = profile?.tenant?.max_storage_gb || 5;
  const maxStorageBytes = maxStorageGb * 1024 * 1024 * 1024;
  const storageUsagePercent = (totalStorage / maxStorageBytes) * 100;

  const handleAddDocument = () => {
    if (totalStorage >= maxStorageBytes) {
      alert(`Limite de stockage atteinte (${maxStorageGb} GB). Veuillez passer au plan supérieur ou supprimer des documents.`);
      return;
    }
    setEditingDoc(null);
    setIsModalOpen(true);
  };

  const toggleClient = (name: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleCase = (id: string) => {
    setExpandedCases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group documents by client > case
  const groupedData = React.useMemo((): GroupedClient[] => {
    const clientMap = new Map<string, Map<string, { caseTitle: string; docs: any[] }>>();
    
    docs.forEach(d => {
      const clientName = d.case?.client?.full_name || 'Autres documents';
      const cId = d.case_id || '__none__';
      const cTitle = d.case?.title || 'Sans dossier';

      if (!clientMap.has(clientName)) clientMap.set(clientName, new Map());
      const casesMap = clientMap.get(clientName)!;
      if (!casesMap.has(cId)) casesMap.set(cId, { caseTitle: cTitle, docs: [] });
      casesMap.get(cId)!.docs.push(d);
    });

    const result: GroupedClient[] = [];
    // Sort: real clients first, "Autres documents" last
    const sortedClients = Array.from(clientMap.keys()).sort((a, b) => {
      if (a === 'Autres documents') return 1;
      if (b === 'Autres documents') return -1;
      return a.localeCompare(b);
    });

    sortedClients.forEach(clientName => {
      const casesMap = clientMap.get(clientName)!;
      const cases: GroupedClient['cases'] = [];
      casesMap.forEach((val, caseId) => {
        cases.push({ caseId, caseTitle: val.caseTitle, docs: val.docs });
      });
      result.push({ clientName, cases });
    });

    return result;
  }, [docs]);

  const DocRow = ({ d }: { d: any }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: '1px solid hsla(var(--text-muted), 0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
        <FileText size={16} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
        <span style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</span>
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', flexShrink: 0 }}>{formatSize(d.file_size)}</span>
        {d.tags?.map((tag: string, i: number) => (
          <span key={i} style={{ padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', fontSize: '0.65rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))', flexShrink: 0 }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
        <button onClick={() => handleDownload(d.file_path, d.file_name)} title="Télécharger" style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', cursor: 'pointer', padding: '0.35rem' }}><Download size={16} /></button>
        <button onClick={() => { setEditingDoc(d); setIsModalOpen(true); }} title="Modifier" style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '0.35rem' }}><Edit2 size={16} /></button>
        <button onClick={() => handleDelete(d.id)} title="Supprimer" style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer', padding: '0.35rem' }}><Trash2 size={16} /></button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ marginBottom: '0.25rem' }}>Documents</h3>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            Stockage : {formatSize(totalStorage)} / {maxStorageGb} GB ({storageUsagePercent.toFixed(1)}%)
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAddDocument}>
          <Plus size={18} /> Nouveau Document
        </button>
      </div>

      {caseId && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard/cases')} style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            &larr; Retour aux dossiers
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
      ) : caseId ? (
        /* Flat list when filtering by case */
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.2)' }}>
                <th style={{ padding: '1rem 0' }}>Nom</th><th>Dossier</th><th>Ajouté par</th><th>Taille</th><th>Tags</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <td style={{ padding: '1rem 0', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} style={{ color: 'hsl(var(--primary))' }} /> {d.file_name}
                  </td>
                  <td>{d.case?.title || '-'}</td>
                  <td>{d.uploader?.full_name || '-'}</td>
                  <td>{formatSize(d.file_size)}</td>
                  <td>
                    {d.tags?.map((t: string, i: number) => (
                      <span key={i} style={{ padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))', marginRight: '0.25rem' }}>{t}</span>
                    ))}
                  </td>
                  <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button onClick={() => handleDownload(d.file_path, d.file_name)} title="Télécharger" style={{ background: 'none', border: 'none', color: 'hsl(var(--primary))', cursor: 'pointer' }}><Download size={18} /></button>
                    <button onClick={() => { setEditingDoc(d); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(d.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer' }}><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '1rem 0', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun document</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grouped view: Client > Case > Documents */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {docs.length === 0 && (
            <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun document</div>
          )}
          {groupedData.map(group => {
            const isClientOpen = expandedClients.has(group.clientName);
            const totalDocs = group.cases.reduce((acc, c) => acc + c.docs.length, 0);

            return (
              <div key={group.clientName} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Client header */}
                <div
                  onClick={() => toggleClient(group.clientName)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', cursor: 'pointer', background: 'hsla(var(--primary), 0.03)', borderBottom: isClientOpen ? '1px solid hsla(var(--text-muted), 0.1)' : 'none' }}
                >
                  {isClientOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <User size={18} style={{ color: 'hsl(var(--primary))' }} />
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>{group.clientName}</span>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginLeft: 'auto' }}>
                    {group.cases.length} dossier{group.cases.length > 1 ? 's' : ''} • {totalDocs} document{totalDocs > 1 ? 's' : ''}
                  </span>
                </div>

                {isClientOpen && group.cases.map(caseGroup => {
                  const isCaseOpen = expandedCases.has(caseGroup.caseId);
                  return (
                    <div key={caseGroup.caseId}>
                      {/* Case header */}
                      <div
                        onClick={() => toggleCase(caseGroup.caseId)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem 0.75rem 2.5rem', cursor: 'pointer', background: 'hsla(var(--text-muted), 0.02)', borderBottom: '1px solid hsla(var(--text-muted), 0.06)' }}
                      >
                        {isCaseOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <FolderOpen size={16} style={{ color: 'hsl(var(--warning))' }} />
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{caseGroup.caseTitle}</span>
                        <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginLeft: 'auto' }}>
                          {caseGroup.docs.length} document{caseGroup.docs.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      {isCaseOpen && (
                        <div style={{ paddingLeft: '3.5rem' }}>
                          {caseGroup.docs.map(d => <DocRow key={d.id} d={d} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <DocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} docToEdit={editingDoc} onSuccess={fetchDocs} />
      )}
    </div>
  );
};
