import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { X, Users } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit: any;
  onSuccess: () => void;
  defaultDate?: string;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, eventToEdit, onSuccess, defaultDate }) => {
  const { profile, user } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [caseId, setCaseId] = useState('');
  const [criticality, setCriticality] = useState('medium');
  const [eventType, setEventType] = useState('general');
  const [cases, setCases] = useState<any[]>([]);
  const [firmUsers, setFirmUsers] = useState<any[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && profile?.tenant_id) {
      supabase.from('cases').select('id, title').eq('tenant_id', profile.tenant_id).eq('status', 'open')
        .then(({ data }) => { if (data) setCases(data); });
      supabase.from('users').select('id, full_name, role').eq('tenant_id', profile.tenant_id).neq('role', 'client').order('full_name')
        .then(({ data }) => { if (data) setFirmUsers(data); });
    }
  }, [profile?.tenant_id, isOpen]);

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title); setDescription(eventToEdit.description || '');
      setStartTime(eventToEdit.start_time?.slice(0, 16) || '');
      setEndTime(eventToEdit.end_time?.slice(0, 16) || '');
      setCaseId(eventToEdit.case_id || '');
      setCriticality(eventToEdit.criticality || 'medium');
      setEventType(eventToEdit.event_type || 'general');
      
      // Fetch existing assignments
      supabase.from('event_assignments').select('user_id').eq('event_id', eventToEdit.id)
        .then(({ data }) => {
          if (data) setAssignedUserIds(data.map(d => d.user_id));
        });
    } else {
      setTitle(''); setDescription(''); setCaseId('');
      setCriticality('medium'); setEventType('general');
      setAssignedUserIds([]);
      const d = defaultDate || new Date().toISOString().slice(0, 10);
      setStartTime(`${d}T09:00`); setEndTime(`${d}T10:00`);
    }
    setError('');
  }, [eventToEdit, defaultDate]);

  if (!isOpen) return null;

  const toggleUserAssignment = (userId: string) => {
    setAssignedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');

    const payload = {
      title, description,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      case_id: caseId || null,
      criticality, event_type: eventType,
      tenant_id: profile?.tenant_id
    };

    try {
      let eventId = eventToEdit?.id;

      if (eventToEdit) {
        const { tenant_id, ...up } = payload;
        const { error: err } = await supabase.from('events').update(up).eq('id', eventId);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.from('events').insert(payload).select('id').single();
        if (err) throw err;
        eventId = data.id;

        // Notifications
        if (profile?.tenant_id && assignedUserIds.length > 0) {
          const notifications = assignedUserIds.filter(id => id !== user?.id).map(userId => ({
            tenant_id: profile.tenant_id,
            user_id: userId,
            title: `Nouvel événement assigné: ${title}`,
            message: `${new Date(startTime).toLocaleDateString('fr-FR')} - Vous avez été assigné à cet événement.`,
            type: criticality === 'urgent' ? 'urgent' : 'info'
          }));
          if (notifications.length > 0) await supabase.from('notifications').insert(notifications);
        }
      }

      // Update assignments
      if (eventId) {
        await supabase.from('event_assignments').delete().eq('event_id', eventId);
        if (assignedUserIds.length > 0) {
          const assignments = assignedUserIds.map(uid => ({
            event_id: eventId, user_id: uid, assigned_by: user?.id
          }));
          await supabase.from('event_assignments').insert(assignments);
        }
      }

      onSuccess(); onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '550px', position: 'relative', margin: 'auto 0' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}><X size={24} /></button>
        <h2 style={{ marginBottom: '1.5rem' }}>{eventToEdit ? 'Modifier Événement' : 'Nouvel Événement'}</h2>
        {error && <div className="error-alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">Titre *</label>
            <input type="text" className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Début *</label>
              <input type="datetime-local" className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Fin *</label>
              <input type="datetime-local" className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Niveau de criticité</label>
              <select className="input-field" value={criticality} onChange={(e) => setCriticality(e.target.value)}>
                <option value="low">🟢 Faible</option>
                <option value="medium">🔵 Moyen</option>
                <option value="high">🟠 Élevé</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Type d'événement</label>
              <select className="input-field" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="general">Général</option>
                <option value="audience">Audience</option>
                <option value="reunion">Réunion</option>
                <option value="deadline">Échéance</option>
                <option value="rdv_client">RDV Client</option>
                <option value="depot_document">Dépôt de document</option>
              </select>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Dossier lié (optionnel)</label>
            <select className="input-field" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              <option value="">-- Aucun --</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} /> Collaborateurs assignés
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'hsla(var(--text-muted), 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              {firmUsers.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={assignedUserIds.includes(u.id)} onChange={() => toggleUserAssignment(u.id)} style={{ width: '16px', height: '16px', accentColor: 'hsl(var(--primary))' }} />
                  <span style={{ fontWeight: 500 }}>{u.full_name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', background: 'hsla(var(--text-muted), 0.1)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)' }}>{u.role.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
};
