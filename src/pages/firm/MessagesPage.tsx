import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Check, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const MessagesPage = () => {
  const { profile, user } = useAuthStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchContacts = React.useCallback(async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('users').select('id, full_name, role')
        .eq('tenant_id', profile?.tenant_id)
        .neq('id', user?.id)
        .order('full_name');
      if (data) setContacts(data);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.tenant_id, user?.id]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const fetchMessages = React.useCallback(async (contactId: string) => {
    if (!profile?.tenant_id || !user?.id) return;
    try {
      const { data } = await supabase.from('messages').select('*')
        .eq('tenant_id', profile?.tenant_id)
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      // Mark as read
      await supabase.from('messages').update({ read_status: true })
        .eq('receiver_id', user?.id).eq('sender_id', contactId).eq('read_status', false);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [profile?.tenant_id, user?.id]);

  const selectContact = (contact: any) => {
    setSelectedContact(contact);
    fetchMessages(contact.id);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact) return;
    setSending(true);
    await supabase.from('messages').insert({
      tenant_id: profile?.tenant_id,
      sender_id: user?.id,
      receiver_id: selectedContact.id,
      content: newMessage.trim()
    });
    setNewMessage('');
    fetchMessages(selectedContact.id);
    setSending(false);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 180px)' }}>
      {/* Contacts List */}
      <div className="glass-card" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', fontWeight: 600 }}>Contacts</div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <p style={{ padding: '1rem' }}>Chargement...</p> : contacts.map(c => (
            <button key={c.id} onClick={() => selectContact(c)}
              style={{
                width: '100%', padding: '0.75rem 1rem', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: selectedContact?.id === c.id ? 'hsla(var(--primary), 0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'var(--transition)'
              }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'hsla(var(--primary), 0.15)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                {c.full_name?.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{c.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'capitalize' }}>{c.role.replace('_', ' ')}</div>
              </div>
            </button>
          ))}
          {contacts.length === 0 && !loading && <p style={{ padding: '1rem', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>Aucun contact</p>}
        </div>
      </div>

      {/* Chat Area */}
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedContact ? (
          <>
            <div style={{ padding: '1rem', borderBottom: '1px solid hsla(var(--text-muted), 0.1)', fontWeight: 600 }}>
              {selectedContact.full_name}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map(m => {
                const isMine = m.sender_id === user?.id;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '70%', padding: '0.6rem 1rem', borderRadius: isMine ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                      background: isMine ? 'hsl(var(--primary))' : 'hsla(var(--text-muted), 0.08)',
                      color: isMine ? 'white' : 'hsl(var(--text-main))'
                    }}>
                      <div style={{ fontSize: '0.9rem' }}>{m.content}</div>
                      <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {isMine && (m.read_status ? <CheckCheck size={12} /> : <Check size={12} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', marginTop: '2rem' }}>Aucun message. Commencez la conversation !</p>}
            </div>
            <form onSubmit={sendMessage} style={{ padding: '1rem', borderTop: '1px solid hsla(var(--text-muted), 0.1)', display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="input-field" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Écrire un message..." style={{ flex: 1 }} />
              <button type="submit" className="btn btn-primary" disabled={sending || !newMessage.trim()} style={{ padding: '0.75rem' }}>
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
            <p>Sélectionnez un contact pour démarrer une conversation</p>
          </div>
        )}
      </div>
    </div>
  );
};
