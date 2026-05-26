import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { Briefcase, Users, CreditCard, FolderOpen, Calendar, AlertCircle, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface KPI { label: string; value: number; icon: React.ReactNode; color: string; }

const PieChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const { t } = useTranslation();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p style={{ color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '2rem' }}>{t('common.no_data')}</p>;
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
  const { t, i18n } = useTranslation();
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
        { label: t('sidebar.tenants'), value: tenants.count || 0, icon: <Briefcase size={24} />, color: '220 80% 40%' },
        { label: t('sidebar.users'), value: users.count || 0, icon: <Users size={24} />, color: '150 60% 40%' },
        { label: t('sidebar.currencies'), value: currencies.count || 0, icon: <CreditCard size={24} />, color: '40 90% 50%' },
      ]);
    } else if (tid) {
      const isLawyer = profile?.role === 'lawyer';
      let assignedCaseIds: string[] = [];

      if (isLawyer) {
        const { data: assignments } = await supabase
          .from('case_assignments')
          .select('case_id')
          .eq('user_id', profile.id)
          .eq('tenant_id', tid);
        assignedCaseIds = assignments?.map(a => a.case_id) || [];
      }

      let casesQuery = supabase.from('cases').select('id, status, outcome, payment_status').eq('tenant_id', tid);
      let clientsQuery = supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tid);
      let eventsQuery = supabase.from('events').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('start_time', new Date().toISOString());
      let invoicesUnpaidQuery = supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).in('status', ['sent', 'overdue']);
      let invoicesPaidQuery = supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'paid');

      if (isLawyer) {
        if (assignedCaseIds.length === 0) {
          casesQuery = casesQuery.eq('id', '00000000-0000-0000-0000-000000000000'); 
        } else {
          casesQuery = casesQuery.in('id', assignedCaseIds);
        }
      }

      const [allCases, clientsCount, eventsCount, invoicesUnpaid, invoicesPaid] = await Promise.all([
        casesQuery,
        clientsQuery,
        eventsQuery,
        invoicesUnpaidQuery,
        invoicesPaidQuery,
      ]);

      const cases = allCases.data || [];
      const open = cases.filter(c => c.status === 'open').length;
      const closed = cases.filter(c => c.status === 'closed').length;
      const won = cases.filter(c => c.outcome === 'won').length;
      const lost = cases.filter(c => c.outcome === 'lost').length;
      const settled = cases.filter(c => c.outcome === 'settled').length;

      const baseKpis: KPI[] = [
        { label: t('dashboard.open_cases'), value: open, icon: <FolderOpen size={24} />, color: '220 80% 40%' },
        { label: t('dashboard.closed_cases'), value: closed, icon: <CheckCircle size={24} />, color: '150 60% 40%' },
        { label: t('dashboard.clients'), value: clientsCount.count || 0, icon: <Users size={24} />, color: '280 60% 50%' },
      ];

      if (profile?.role !== 'secretary') {
        baseKpis.push({ label: t('dashboard.won_cases'), value: won, icon: <TrendingUp size={24} />, color: '150 70% 40%' });
        baseKpis.push({ label: t('dashboard.lost_cases'), value: lost, icon: <XCircle size={24} />, color: '350 70% 50%' });
      }

      baseKpis.push({ label: t('dashboard.upcoming_events'), value: eventsCount.count || 0, icon: <Calendar size={24} />, color: '40 90% 50%' });
      baseKpis.push({ label: t('dashboard.unpaid_invoices'), value: invoicesUnpaid.count || 0, icon: <AlertCircle size={24} />, color: '350 70% 50%' });
      baseKpis.push({ label: t('dashboard.paid_invoices'), value: invoicesPaid.count || 0, icon: <CreditCard size={24} />, color: '150 60% 40%' });

      setKpis(baseKpis);

      const pending = cases.filter(c => c.status === 'pending').length;
      const archived = cases.filter(c => c.status === 'archived').length;
      setCaseStatusData([
        { label: t('dashboard.ongoing'), value: open, color: 'hsl(220, 80%, 50%)' },
        { label: t('dashboard.pending'), value: pending, color: 'hsl(40, 90%, 50%)' },
        { label: t('dashboard.closed'), value: closed, color: 'hsl(150, 60%, 40%)' },
        { label: t('dashboard.archived'), value: archived, color: 'hsl(220, 15%, 60%)' },
      ]);
      setCaseOutcomeData([
        { label: t('dashboard.won'), value: won, color: 'hsl(150, 70%, 40%)' },
        { label: t('dashboard.lost'), value: lost, color: 'hsl(350, 70%, 50%)' },
        { label: t('dashboard.settled'), value: settled, color: 'hsl(40, 90%, 50%)' },
        { label: t('dashboard.ongoing'), value: cases.filter(c => c.outcome === 'ongoing').length, color: 'hsl(220, 80%, 50%)' },
      ]);

      const pPending = cases.filter(c => c.payment_status === 'pending').length;
      const pPartial = cases.filter(c => c.payment_status === 'partial').length;
      const pPaid = cases.filter(c => c.payment_status === 'paid').length;
      setPaymentData([
        { label: t('dashboard.pending'), value: pPending, color: 'hsl(40, 90%, 50%)' },
        { label: t('dashboard.partial'), value: pPartial, color: 'hsl(220, 80%, 50%)' },
        { label: t('dashboard.paid'), value: pPaid, color: 'hsl(150, 70%, 40%)' },
      ]);

      let rcQuery = supabase.from('cases')
        .select('id, title, status, outcome, created_at, client:clients(full_name)')
        .eq('tenant_id', tid).order('created_at', { ascending: false }).limit(5);
      
      if (isLawyer) {
        if (assignedCaseIds.length === 0) {
          rcQuery = rcQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        } else {
          rcQuery = rcQuery.in('id', assignedCaseIds);
        }
      }
      const { data: rc } = await rcQuery;
      if (rc) setRecentCases(rc);

      const { data: ev } = await supabase.from('events')
        .select('id, title, start_time, criticality')
        .eq('tenant_id', tid).gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true }).limit(5);
      if (ev) setUpcomingEvents(ev);
    }
    setLoading(false);
  }, [profile?.id, profile?.tenant_id, profile?.role, t]);

  useEffect(() => { if (profile) loadData(); }, [profile, loadData]);

  if (loading) return <div className="glass-card animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;

  const statusLabels: Record<string, string> = { 
    open: t('dashboard.ongoing'), 
    closed: t('dashboard.closed'), 
    pending: t('dashboard.pending'), 
    archived: t('dashboard.archived') 
  };
  const critColors: Record<string, string> = { low: 'var(--success)', medium: 'var(--primary)', high: 'var(--warning)', urgent: 'var(--danger)' };
  const critLabels: Record<string, string> = { 
    low: t('common.low', 'Faible'), 
    medium: t('common.medium', 'Moyen'), 
    high: t('common.high', 'Élevé'), 
    urgent: t('common.urgent', 'Urgent') 
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

      {profile?.role !== 'root_admin' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>{t('dashboard.case_status')}</h4>
              <PieChart data={caseStatusData} />
            </div>
            {profile?.role !== 'secretary' && (
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>{t('dashboard.case_outcome')}</h4>
                <BarChart data={caseOutcomeData} />
              </div>
            )}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>{t('dashboard.case_payments')}</h4>
              <PieChart data={paymentData} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}><FolderOpen size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('dashboard.recent_cases')}</h4>
              {recentCases.length === 0 ? <p style={{ color: 'hsl(var(--text-muted))' }}>{t('dashboard.no_cases')}</p> : recentCases.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--text-muted), 0.04)', marginBottom: '0.4rem' }}>
                  <div><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</div><div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{c.client?.full_name || '-'}</div></div>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))' }}>{statusLabels[c.status]}</span>
                </div>
              ))}
            </div>
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}><Calendar size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('dashboard.upcoming_events')}</h4>
              {upcomingEvents.length === 0 ? <p style={{ color: 'hsl(var(--text-muted))' }}>{t('dashboard.no_events')}</p> : upcomingEvents.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'hsla(var(--text-muted), 0.04)', marginBottom: '0.4rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', fontSize: '0.65rem', background: `hsla(${critColors[e.criticality]}, 0.12)`, color: `hsl(${critColors[e.criticality]})` }}>{critLabels[e.criticality]}</span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{new Date(e.start_time).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</span>
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
