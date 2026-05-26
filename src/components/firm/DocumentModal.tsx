import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { X, UploadCloud } from 'lucide-react';
import { Portal } from '../common/Portal';

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docToEdit: any;
  onSuccess: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({ isOpen, onClose, docToEdit, onSuccess }) => {
  const { t } = useTranslation();
  const { profile, user } = useAuthStore();
  const [fileName, setFileName] = useState('');
  const [tags, setTags] = useState('');
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchCases = async () => {
      if (!isOpen || !profile?.tenant_id) return;
      
      try {
        let query = supabase.from('cases').select('id, title');
        
        if (profile.role === 'lawyer') {
          const { data: assignments } = await supabase
            .from('case_assignments')
            .select('case_id')
            .eq('user_id', profile.id)
            .eq('tenant_id', profile.tenant_id);
          
          const assignedIds = assignments?.map(a => a.case_id) || [];
          if (assignedIds.length > 0) {
            query = query.in('id', assignedIds);
          } else {
            setCases([]);
            return;
          }
        } else {
          query = query.eq('tenant_id', profile.tenant_id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setCases(data);
      } catch (err) {
        console.error('Error fetching cases for document modal:', err);
      }
    };

    fetchCases();
  }, [profile?.id, profile?.tenant_id, profile?.role, isOpen]);

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
      const maxSize = 3 * 1024 * 1024; // 3 MB
      if (file.size > maxSize) {
        setError(t('cases.documents.modal.error_file_too_large'));
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
      setError(t('cases.documents.modal.error_select_file'));
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      let finalFilePath = docToEdit?.file_path;
      let finalFileSize = docToEdit?.file_size;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const path = `${profile?.tenant_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, selectedFile);
        if (uploadError) throw new Error(t('cases.documents.modal.error_upload') + uploadError.message);
        
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
    <Portal>
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><X size={24} /></button>
        <h2 style={{ marginBottom: '1.5rem' }}>{docToEdit ? t('cases.documents.modal.edit_title') : t('cases.documents.modal.new_title')}</h2>
        {error && <div className="error-alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UploadCloud size={16} /> {docToEdit ? t('cases.documents.modal.field_file_replace') : t('cases.documents.modal.field_file')}
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
              {t('cases.documents.modal.file_help')}
            </small>
          </div>

          <div className="input-group">
            <label className="input-label">{t('cases.documents.modal.field_name')}</label>
            <input type="text" className="input-field" value={fileName} onChange={(e) => setFileName(e.target.value)} required />
          </div>

          <div className="input-group">
            <label className="input-label">{t('cases.documents.modal.field_tags')}</label>
            <input type="text" className="input-field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('cases.documents.modal.placeholder_tags')} />
          </div>
          
          <div className="input-group">
            <label className="input-label">{t('cases.documents.modal.field_case')}</label>
            <select className="input-field" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">{t('cases.documents.modal.none')}</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? t('cases.documents.modal.saving') : t('cases.documents.modal.save')}
          </button>
        </form>
      </div>
    </div>
    </Portal>
  );
};
