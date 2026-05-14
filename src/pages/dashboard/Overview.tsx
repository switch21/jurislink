import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Briefcase, Users, CreditCard, FolderOpen, Calendar, AlertCircle, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface KPI { label: string; value: number; icon: React.ReactNode; color: string; }

const PieChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '2rem' }}>Aucune donnée</p>;
  let cumulative = 0;
  const size = 160;
  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          if (d.value === 0) return null;
          const pct = d.value / total;
          const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
          cumulative += pct;
          const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
          const large = pct > 0.5 ? 1 : 0;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          if (pct >= 1) return <circle key={i} cx={cx} cy={cy} r={r} fill={d.color} />;
          return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`} fill={d.color} />;
        })}
        <circle cx={cx} cy={cy} r={35} fill="rgba(255,255,255,0.9)" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="18" fontWeight="700" fill="hsl(var(--text-main))">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
            <span>{d.label}: <strong>{d.value}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
};

const BarChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: 120, justifyContent: 'center' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{d.value}</span>
          <div style={{ width: 36, height: `${(d.value / max) * 90}px`, background: d.color, borderRadius: '4px 4px 0 0', minHeight: 4, transition: 'height 0.5s ease' }} />
          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export const Overview = () => {
  const { profile } = useAuthStore();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [caseStatusData, setCaseStatusData] = useState<any[]>([]);
  const [caseOutcomeData, setCaseOutcomeData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const isRoot = profile?.role === 'root_admin';
    const tid = profile?.tenant_id;

    if (isRoot) {
      const [tenants, users, currencies] = await Promise.all([
        supabase.from('tenants').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('currencies').select('id', { count: 'exact', head: true }),
      ]);
      setKpis([
        { label: 'Cabinets', value: tenants.count || 0, icon: <Briefcase size={24} />, color: '220 80% 40%' },
        { label: 'Utilisateurs', value: users.count || 0, icon: <Users size={24} />, color: '150 60% 40%' },
        { label: 'Devises', value: currencies.count || 0, icon: <CreditCard size={24} />, color: '40 90% 50%' },
      ]);
    } else if (tid) {
      const [openC, closedC, allCases, clientsCount, eventsCount, invoicesUnpaid, invoicesPaid] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'open'),
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'closed'),
        supabase.from('cases').select('id, status, outcome, payment_status').eq('tenant_id', tid),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('start_time', new Date().toISOString()),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).in('status', ['sent', 'overdue']),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'paid'),
      ]);

      const cases = allCases.data || [];
      const won = cases.filter(c => c.outcome === 'won').length;
      const lost = cases.filter(c => c.outcome === 'lost').length;
      const settled = cases.filter(c => c.outcome === 'settled').length;

      setKpis([
        { label: 'Dossiers ouverts', value: openC.count || 0, icon: <FolderOpen size={24} />, color: '220 80% 40%' },
        { label: 'Dossiers clôturés', value: closedC.count || 0, icon: <CheckCircle size={24} />, color: '150 60% 40%' },
        { label: 'Clients', value: clientsCount.count || 0, icon: <Users size={24} />, color: '280 60% 50%' },
        { label: 'Cas gagnés', value: won, icon: <TrendingUp size={24} />, color: '150 70% 40%' },
        { label: 'Cas perdus', value: lost, icon: <XCircle size={24} />, color: '350 70% 50%' },
        { label: 'Événements à venir', value: eventsCount.count || 0, icon: <Calendar size={24} />, color: '40 90% 50%' },
        { label: 'Factures impayées', value: invoicesUnpaid.count || 0, icon: <AlertCircle size={24} />, color: '350 70% 50%' },
        { label: 'Factures payées', value: invoicesPaid.count || 0, icon: <CreditCard size={24} />, color: '150 60% 40%' },
      ]);

      // Chart data
      const open = cases.filter(c => c.status === 'open').length;
      const pending = cases.filter(c => c.status === 'pending').length;
      const closed = cases.filter(c => c.status === 'closed').length;
      const archived = cases.filter(c => c.status === 'archived').length;
      setCaseStatusData([
        { label: 'Ouverts', value: open, color: 'hsl(220, 80%, 50%)' },
        { label: 'En attente', value: pending, color: 'hsl(40, 90%, 50%)' },
        { label: 'Clôturés', value: closed, color: 'hsl(150, 60%, 40%)' },
        { label: 'Archivés', value: archived, color: 'hsl(220, 15%, 60%)' },
      ]);
      setCaseOutcomeData([
        { label: 'Gagnés', value: won, color: 'hsl(150, 70%, 40%)' },
        { label: 'Perdus', value: lost, color: 'hsl(350, 70%, 50%)' },
        { label: 'Réglés', value: settled, color: 'hsl(40, 90%, 50%)' },
        { label: 'En cours', value: cases.filter(c => c.outcome === 'ongoing').length, color: 'hsl(220, 80%, 50%)' },
      ]);

      const pPending = cases.filter(c => c.payment_status === 'pending').length;
      const pPartial = cases.filter(c => c.payment_status === 'partial').length;
      const pPaid = cases.filter(c => c.payment_status === 'paid').length;
      setPaymentData([
        { label: 'En attente', value: pPending, color: 'hsl(40, 90%, 50%)' },
        { label: 'Partiel', value: pPartial, color: 'hsl(220, 80%, 50%)' },
        { label: 'Payé', value: pPaid, color: 'hsl(150, 70%, 40%)' },
      ]);

      const { data: rc } = await supabase.from('cases')
        .select('id, title, status, outcome, created_at, client:clients(full_name)')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(5);
      if (rc) setRecentCases(rc);

      const { data: ev } = await supabase.from('events')
        .select('id, title, start_time, criticality')
        .eq('tenant_id', tid).gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true }).limit(5);
      if (ev) setUpcomingEvents(ev);
    }
    setLoading(false);
  }, [profile?.id, profile?.tenant_id, profile?.role]);

  useEffect(() => { if (profile) loadData(); }, [profile, loadData]);

  if (loading) return <div className="glass-card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>;

  const statusLabels: Record<string, string> = { open: 'En cours', closed: 'Clôturé', pending: 'En attente', archived: 'Archivé' };
  const critColors: Record<string, string> = { low: 'var(--success)', medium: 'var(--primary)', high: 'var(--warning)', urgent: 'var(--danger)' };
  const critLabels: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé', urgent: 'Urgent' };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {kpis.map((kpi, i) => (
          <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `hsla(${kpi.color}, 0.12)`, color: `hsl(${kpi.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{kpi.icon}</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit' }}>{kpi.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts - only for firm users */}
      {profile?.role !== 'root_admin' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Statut des dossiers</h4>
              <PieChart data={caseStatusData} />
            </div>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Résultat des affaires</h4>
              <BarChart data={caseOutcomeData} />
            </div>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Paiements des dossiers</h4>
              <PieChart data={paymentData} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}><FolderOpen size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Dossiers récents</h4>
              {recentCases.length === 0 ? <p style={{ color: 'hsl(var(--text-muted))' }}>Aucun dossier</p> : recentCases.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--text-muted), 0.04)', marginBottom: '0.4rem' }}>
                  <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</div><div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{c.client?.full_name || '-'}</div></div>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))' }}>{statusLabels[c.status]}</span>
                </div>
              ))}
            </div>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}><Calendar size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Prochains événements</h4>
              {upcomingEvents.length === 0 ? <p style={{ color: 'hsl(var(--text-muted))' }}>Aucun événement</p> : upcomingEvents.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--text-muted), 0.04)', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', fontSize: '0.65rem', background: `hsla(${critColors[e.criticality]}, 0.12)`, color: `hsl(${critColors[e.criticality]})` }}>{critLabels[e.criticality]}</span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{new Date(e.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
