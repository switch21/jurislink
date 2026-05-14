import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Bell, X, Check } from 'lucide-react';

export const NotificationBell = () => {
  const { profile, user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = React.useCallback(async () => {
    const userId = user?.id;
    const tenantId = profile?.tenant_id;
    if (!userId || !tenantId) return;

    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', userId).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }).limit(20);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }
  }, [user?.id, profile?.tenant_id]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user?.id).eq('read', false);
    fetchNotifications();
  };

  const typeColors: Record<string, string> = { urgent: 'var(--danger)', warning: 'var(--warning)', info: 'var(--primary)' };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{
        background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
        color: 'hsl(var(--text-muted))', padding: '0.5rem'
      }}>
        <Bell size={22} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: 'hsl(var(--danger))', color: 'white',
            fontSize: '0.65rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setIsOpen(false)} />
          <div className="glass-card" style={{
            position: 'absolute', top: '100%', right: 0, width: 360, maxHeight: 420,
            zIndex: 999, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'hsl(var(--primary))' }}>
                  Tout marquer lu
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>Aucune notification</p>
              ) : notifications.map(n => (
                <div key={n.id} style={{
                  padding: '0.75rem 1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.06)',
                  background: n.read ? 'transparent' : 'hsla(var(--primary), 0.04)',
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                    background: n.read ? 'transparent' : `hsl(${typeColors[n.type] || 'var(--primary)'})`
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                    {n.message && <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: 2 }}>{n.message}</div>}
                    <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.read && (
                    <button onClick={() => markAsRead(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', flexShrink: 0 }}>
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
