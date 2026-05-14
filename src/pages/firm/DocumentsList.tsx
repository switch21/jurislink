import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, FileText, Download } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DocumentModal } from '../../components/firm/DocumentModal';

export const DocumentsList = () => {
  const { profile } = useAuthStore();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);

  const fetchDocs = React.useCallback(async () => {
    if (!profile?.tenant_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('documents')
        .select('*, uploader:users(full_name), case:cases(title)')
        .eq('tenant_id', profile?.tenant_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setDocs(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { 
    fetchDocs(); 
  }, [fetchDocs]);

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
        // Create an invisible A element and click it to download
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

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Documents</h3>
        <button className="btn btn-primary" onClick={() => { setEditingDoc(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Nouveau Document
        </button>
      </div>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? <p>Chargement...</p> : (
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
        )}
      </div>
      {isModalOpen && (
        <DocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} docToEdit={editingDoc} onSuccess={fetchDocs} />
      )}
    </div>
  );
};
