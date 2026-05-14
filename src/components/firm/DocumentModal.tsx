import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { X, UploadCloud } from 'lucide-react';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docToEdit: any;
  onSuccess: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ isOpen, onClose, docToEdit, onSuccess }) => {
  const { profile, user } = useAuthStore();
  const [fileName, setFileName] = useState('');
  const [tags, setTags] = useState('');
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen && profile?.tenant_id) {
      supabase.from('cases').select('id, title')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setCases(data); });
    }
  }, [profile?.tenant_id, isOpen]);

  useEffect(() => {
    if (docToEdit) {
      setFileName(docToEdit.file_name);
      setTags(docToEdit.tags?.join(', ') || '');
      setCaseId(docToEdit.case_id || '');
    } else {
      setFileName(''); setTags(''); setCaseId('');
    }
    setSelectedFile(null);
    setError('');
  }, [docToEdit]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const maxSize = 3 * 1024 * 1024; // 3 Mo
      if (file.size > maxSize) {
        setError('Le fichier ne doit pas dépasser 3 Mo.');
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setError('');
      if (!fileName) {
        setFileName(file.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docToEdit && !selectedFile) {
      setError('Veuillez sélectionner un fichier.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      let finalFilePath = docToEdit?.file_path;
      let finalFileSize = docToEdit?.file_size;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const path = `${profile?.tenant_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, selectedFile);
        if (uploadError) throw new Error("Erreur lors de l'envoi du fichier: " + uploadError.message);
        
        finalFilePath = path;
        finalFileSize = selectedFile.size;
      }

      const payload = {
        file_name: fileName,
        file_path: finalFilePath,
        file_size: finalFileSize,
        tags: tagsArray,
        case_id: caseId || null,
        tenant_id: profile?.tenant_id,
        uploader_id: user?.id
      };

      if (docToEdit) {
        const { error: err } = await supabase.from('documents')
          .update({ file_name: fileName, file_path: finalFilePath, file_size: finalFileSize, tags: tagsArray, case_id: caseId || null })
          .eq('id', docToEdit.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('documents').insert(payload);
        if (err) throw err;
      }

      onSuccess(); 
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><X size={24} /></button>
        <h2 style={{ marginBottom: '1.5rem' }}>{docToEdit ? 'Modifier Document' : 'Nouveau Document'}</h2>
        {error && <div className="error-alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UploadCloud size={16} /> {docToEdit ? 'Remplacer le fichier (optionnel)' : 'Fichier *'}
            </label>
            <input 
              type="file" 
              className="input-field" 
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" 
              onChange={handleFileChange} 
              required={!docToEdit} 
              style={{ padding: '0.5rem' }} 
            />
            <small style={{ color: 'hsl(var(--text-muted))', marginTop: '0.25rem', display: 'block' }}>
              Taille maximale : 3 Mo. Formats acceptés : PDF, DOC, Excel, Images.
            </small>
          </div>

          <div className="input-group">
            <label className="input-label">Nom du fichier</label>
            <input type="text" className="input-field" value={fileName} onChange={(e) => setFileName(e.target.value)} required />
          </div>

          <div className="input-group">
            <label className="input-label">Tags (séparés par des virgules)</label>
            <input type="text" className="input-field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="contrat, facture, pièce" />
          </div>
          
          <div className="input-group">
            <label className="input-label">Dossier lié (optionnel)</label>
            <select className="input-field" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">-- Aucun --</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};
