import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { EventModal } from '../../components/firm/EventModal';

export const CalendarPage = () => {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => { 
    if (profile?.tenant_id) {
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      fetchEvents(start, end);
    }
  }, [profile?.tenant_id, currentMonth]);

  const fetchEvents = React.useCallback(async (start?: Date, end?: Date) => {
    setLoading(true);
    if (!profile?.tenant_id) return;
    
    const fetchStart = start || new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const fetchEnd = end || new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

    try {
      const { data, error } = await supabase.from('events').select(`
        *, 
        case:cases(title),
        assignments:event_assignments(user:users!event_assignments_user_id_fkey(full_name))
      `)
        .eq('tenant_id', profile.tenant_id)
        .gte('start_time', fetchStart.toISOString()).lte('start_time', fetchEnd.toISOString())
        .order('start_time', { ascending: true });
        
      if (error) {
        console.error("Erreur lors de la récupération des événements :", error);
      } else if (data) {
        setEvents(data);
      }
    } catch (err) {
      console.error("Exception lors de la récupération des événements :", err);
    }
    setLoading(false);
  }, [profile?.tenant_id, currentMonth]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Supprimer cet événement ?")) {
      await supabase.from('events').delete().eq('id', id);
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      fetchEvents(start, end);
    }
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const generateGoogleCalendarLink = (event: any) => {
    const start = new Date(event.start_time).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(event.end_time).toISOString().replace(/-|:|\.\d\d\d/g, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&details=${encodeURIComponent(event.description || '')}`;
  };

  const downloadICS = (event: any) => {
    const start = new Date(event.start_time).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(event.end_time).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:${event.title}\nDESCRIPTION:${event.description || ''}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = (new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const monthName = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const getEventsForDay = (day: number) => events.filter(e => new Date(e.start_time).getDate() === day);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3>Agenda</h3>
        <button className="btn btn-primary" onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}>
          <Plus size={18} /> Nouvel Événement
        </button>
      </div>

      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={prevMonth} className="btn" style={{ padding: '0.5rem' }}><ChevronLeft size={20} /></button>
          <h4 style={{ textTransform: 'capitalize' }}>{monthName}</h4>
          <button onClick={nextMonth} className="btn" style={{ padding: '0.5rem' }}><ChevronRight size={20} /></button>
        </div>

        {loading ? <p>Chargement...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {dayNames.map(d => (
              <div key={d} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
            {days.map(day => {
              const dayEvents = getEventsForDay(day);
              const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth.getMonth() && new Date().getFullYear() === currentMonth.getFullYear();
              return (
                <div key={day} style={{ minHeight: 70, padding: '0.25rem', borderRadius: 'var(--radius-sm)', background: isToday ? 'hsla(var(--primary), 0.08)' : 'hsla(var(--text-muted), 0.03)', border: isToday ? '2px solid hsl(var(--primary))' : '1px solid hsla(var(--text-muted), 0.1)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>{day}</div>
                  {dayEvents.slice(0, 2).map(ev => {
                    const critColors: Record<string, string> = { low: 'var(--success)', medium: 'var(--primary)', high: 'var(--warning)', urgent: 'var(--danger)' };
                    const color = critColors[ev.criticality] || 'var(--primary)';
                    return (
                    <div key={ev.id} onClick={() => { setEditingEvent(ev); setIsModalOpen(true); }}
                      style={{ fontSize: '0.65rem', padding: '1px 3px', borderRadius: 3, background: `hsla(${color}, 0.15)`, color: `hsl(${color})`, cursor: 'pointer', marginBottom: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {ev.title}
                    </div>
                  )})}
                  {dayEvents.length > 2 && <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))' }}>+{dayEvents.length - 2}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event list below calendar */}
      <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>Événements du mois</h4>
        {events.length === 0 ? <p style={{ color: 'hsl(var(--text-muted))' }}>Aucun événement</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.map(e => {
              const critColors: Record<string, string> = { low: 'var(--success)', medium: 'var(--primary)', high: 'var(--warning)', urgent: 'var(--danger)' };
              const critLabels: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé', urgent: 'Urgent' };
              const typeLabels: Record<string, string> = { general: 'Général', audience: 'Audience', reunion: 'Réunion', deadline: 'Échéance', rdv_client: 'RDV Client', depot_document: 'Dépôt doc.' };
              const color = critColors[e.criticality] || 'var(--primary)';
              
              return (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--text-muted), 0.04)', borderLeft: `3px solid hsl(${color})` }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginBottom: '0.25rem' }}>
                    {new Date(e.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {new Date(e.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à {new Date(e.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {e.case?.title && <span> • Dossier: {e.case.title}</span>}
                  </div>
                  {e.assignments && e.assignments.length > 0 && (
                    <div style={{ fontSize: '0.75rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {e.assignments.map((a: any, i: number) => (
                        <span key={i} style={{ background: 'hsla(var(--text-muted), 0.1)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                          👤 {a.user?.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: 'hsla(var(--text-muted), 0.1)' }}>{typeLabels[e.event_type] || e.event_type}</span>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: `hsla(${color}, 0.12)`, color: `hsl(${color})` }}>{critLabels[e.criticality] || e.criticality}</span>
                  <a href={generateGoogleCalendarLink(e)} target="_blank" rel="noopener noreferrer" title="Ajouter à Google Agenda" style={{ color: 'hsl(var(--text-muted))', marginLeft: '0.5rem', display: 'flex', alignItems: 'center' }}><CalendarIcon size={16} /></a>
                  <button onClick={() => downloadICS(e)} title="Télécharger .ics" style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Download size={16} /></button>
                  <button onClick={() => { setEditingEvent(e); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', marginLeft: '0.5rem' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: 'hsl(var(--danger))', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {isModalOpen && (
        <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} eventToEdit={editingEvent} onSuccess={fetchEvents} />
      )}
    </div>
  );
};
