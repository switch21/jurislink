import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Filter, Clock } from 'lucide-react';

export const EventHistory = () => {
  const { profile } = useAuthStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.tenant_id) {
      supabase.from('clients').select('id, full_name').eq('tenant_id', profile.tenant_id).order('full_name')
        .then(({ data }) => { if (data) setClients(data); });
      fetchEvents();
    }
  }, [profile?.tenant_id]);

  const fetchEvents = React.useCallback(async () => {
    setLoading(true);
    let query = supabase.from('events')
      .select('*, case:cases(title, client_id, client:clients(full_name)), assignments:event_assignments(user:users(full_name))')
      .eq('tenant_id', profile?.tenant_id)
      .order('start_time', { ascending: false });

    if (filterType) query = query.eq('event_type', filterType);
    if (filterCriticality) query = query.eq('criticality', filterCriticality);
    if (filterDateFrom) query = query.gte('start_time', new Date(filterDateFrom).toISOString());
    if (filterDateTo) query = query.lte('start_time', new Date(filterDateTo + 'T23:59:59').toISOString());

    const { data } = await query;
    let filtered = data || [];
    if (filterClient) {
      filtered = filtered.filter((e: any) => e.case?.client_id === filterClient);
    }
    setEvents(filtered);
    setLoading(false);
  }, [profile?.tenant_id, filterType, filterCriticality, filterDateFrom, filterDateTo, filterClient]);

  useEffect(() => { if (profile?.tenant_id) fetchEvents(); }, [profile?.tenant_id, fetchEvents]);

  const critLabels: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé', urgent: 'Urgent' };
  const critColors: Record<string, string> = { low: 'var(--success)', medium: 'var(--primary)', high: 'var(--warning)', urgent: 'var(--danger)' };
  const critEmojis: Record<string, string> = { low: '🟢', medium: '🔵', high: '🟠', urgent: '🔴' };
  const typeLabels: Record<string, string> = { general: 'Général', audience: 'Audience', reunion: 'Réunion', deadline: 'Échéance', rdv_client: 'RDV Client', depot_document: 'Dépôt doc.' };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3><Clock size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />Historique des événements</h3>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <Filter size={16} /> Filtres
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Client</label>
            <select className="input-field" value={filterClient} onChange={(e) => setFilterClient(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
              <option value="">Tous</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Type</label>
            <select className="input-field" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
              <option value="">Tous</option>
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Criticité</label>
            <select className="input-field" value={filterCriticality} onChange={(e) => setFilterCriticality(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
              <option value="">Toutes</option>
              {Object.entries(critLabels).map(([k, v]) => <option key={k} value={k}>{critEmojis[k]} {v}</option>)}
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Du</label>
            <input type="date" className="input-field" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.5rem' }} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontSize: '0.75rem' }}>Au</label>
            <input type="date" className="input-field" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.5rem' }} />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        {loading ? <p>Chargement...</p> : events.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Aucun événement trouvé</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--text-muted), 0.04)', borderLeft: `3px solid hsl(${critColors[e.criticality]})` }}>
                <div style={{ fontSize: '1.25rem' }}>{critEmojis[e.criticality]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{e.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.15rem' }}>
                    <span>{new Date(e.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span>{new Date(e.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(e.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {e.case?.client?.full_name && <span>Client: {e.case.client.full_name}</span>}
                    {e.case?.title && <span>Dossier: {e.case.title}</span>}
                  </div>
                  {e.assignments && e.assignments.length > 0 && (
                    <div style={{ fontSize: '0.75rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {e.assignments.map((a: any, i: number) => (
                        <span key={i} style={{ background: 'hsla(var(--text-muted), 0.1)', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)' }}>
                          👤 {a.user?.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: 'hsla(var(--text-muted), 0.1)' }}>{typeLabels[e.event_type] || e.event_type}</span>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: `hsla(${critColors[e.criticality]}, 0.12)`, color: `hsl(${critColors[e.criticality]})` }}>{critLabels[e.criticality]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
