import { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import { connectSocket, getSocket, subscribeSocket } from '../../services/socket';
import './ChatRoom.css';

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ChatRoom() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);

  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const socket = useSyncExternalStore(subscribeSocket, getSocket, getSocket);
  const typingTimeoutRef = useRef(null);

  const isOnline = otherUser && onlineUsers.has(otherUser.id);

  useEffect(() => {
    connectSocket(token);
  }, [token]);

  useEffect(() => {
    let active = true;

    async function loadConversation() {
      try {
        const [conversationRes, messagesRes] = await Promise.all([
          api.get(`/conversations/${conversationId}`),
          api.get(`/conversations/${conversationId}/messages`),
        ]);
        if (!active) return;
        const other = conversationRes.data.members.find((member) => member.id !== currentUserId);
        setOtherUser(other || null);
        setMessages(messagesRes.data);
      } catch {
        if (active) navigate('/');
      }
    }

    loadConversation();
    return () => { active = false; };
  }, [conversationId, currentUserId, navigate]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.emit('join_conversation', conversationId);

    function handleNewMessage(msg) {
      setMessages((prev) => [...prev, msg]);
      if (msg.sender.id !== currentUserId) {
        socket.emit('mark_as_read', { conversationId, messageId: msg.id });
      }
    }
    function handleUserTyping() { setOtherTyping(true); }
    function handleUserStopTyping() { setOtherTyping(false); }
    function handleMessageRead({ messageId, readAt }) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, readAt } : m)));
    }

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('message_read', handleMessageRead);
      socket.emit('leave_conversation', conversationId);
    };
  }, [conversationId, currentUserId, socket]);

  function handleTextChange(e) {
    setMessage(e.target.value);
    if (!socket) return;
    socket.emit('typing_start', { conversationId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId });
    }, 1500);
  }

  function sendMessage(e) {
    e?.preventDefault();
    const text = message.trim();
    if (!text || !socket) return;

    socket.emit('send_message', { conversationId, content: text, type: 'text' });
    socket.emit('typing_stop', { conversationId });
    setMessage('');
    setAttachmentsOpen(false);
  }

  const avatarUrl =
    otherUser?.avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || '?')}&background=ff5e00&color=fff`;

  return (
    <div className="chat-page">
      <div className="chat-app">
        <header className="chat-header">
          <button className="back-button" aria-label="Kembali" onClick={() => navigate('/')}>
            <Icon>arrow_back_ios_new</Icon>
          </button>

          <div className="chat-contact">
            <div className="chat-avatar">
              <img src={avatarUrl} alt={otherUser?.name || 'Avatar'} />
              {isOnline && <span className="online-dot" />}
            </div>

            <div className="chat-contact-info">
              <div className="chat-contact-name">{otherUser?.name || '...'}</div>
              <div className="chat-contact-status">
                <span className="status-dot" style={{ background: isOnline ? '#16b981' : '#9a9a9a' }} />
                {otherTyping ? 'Mengetik...' : isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>

          <div className="chat-actions">
            <button aria-label="Video call" disabled title="Fitur panggilan belum tersedia">
              <Icon>videocam</Icon>
            </button>
            <button aria-label="Telepon" disabled title="Fitur panggilan belum tersedia">
              <Icon>call</Icon>
            </button>
            <button aria-label="Menu">
              <Icon>more_vert</Icon>
            </button>
          </div>
        </header>

        <main className="chat-main">
          <section className="messages">
            <div className="date-pill">HARI INI</div>

            {messages.map((msg) => {
              const isMine = msg.sender.id === currentUserId;
              return (
                <div className={`message ${isMine ? 'outgoing' : 'incoming'}`} key={msg.id}>
                  <p>{msg.content}</p>
                  <span>
                    {formatTime(msg.createdAt)}
                    {isMine && <Icon>{msg.readAt ? 'done_all' : 'done'}</Icon>}
                  </span>
                </div>
              );
            })}
          </section>

          {attachmentsOpen && (
            <div className="attachment-drawer">
              {[
                ['photo_camera', 'Kamera'],
                ['image', 'Galeri'],
                ['description', 'Dokumen'],
                ['location_on', 'Lokasi'],
              ].map(([icon, label]) => (
                <button key={label} disabled title="Belum tersedia">
                  <span className="attachment-icon">
                    <Icon>{icon}</Icon>
                  </span>
                  <small>{label}</small>
                </button>
              ))}
            </div>
          )}

          <form className="message-dock" onSubmit={sendMessage}>
            <button
              type="button"
              className={`round-action ${attachmentsOpen ? 'active' : ''}`}
              aria-label="Lampiran"
              onClick={() => setAttachmentsOpen((v) => !v)}
            >
              <Icon>{attachmentsOpen ? 'close' : 'add'}</Icon>
            </button>

            <div className="input-pill">
              <button type="button" aria-label="Emoji" disabled title="Belum tersedia">
                <Icon>sentiment_satisfied</Icon>
              </button>

              <input value={message} onChange={handleTextChange} placeholder="Ketik pesan..." />

              <button type="button" aria-label="Stiker" disabled title="Belum tersedia">
                <Icon>note_add</Icon>
              </button>
            </div>

            <button type="submit" className="send-button" aria-label={message.trim() ? 'Kirim Pesan' : 'Rekam Suara'}>
              <Icon>{message.trim() ? 'send' : 'mic'}</Icon>
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default ChatRoom;