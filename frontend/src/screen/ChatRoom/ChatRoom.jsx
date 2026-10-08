import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import { connectSocket, getSocket, subscribeSocket } from '../../services/socket';
import './ChatRoom.css';

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

function formatTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function ChatRoom() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [conversationLoad, setConversationLoad] = useState({
    conversationId: null,
    loading: true,
    error: '',
  });
  const [otherTyping, setOtherTyping] = useState(false);
  const [error, setError] = useState('');
  const socket = useSyncExternalStore(subscribeSocket, getSocket, getSocket);
  const threadRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const loadStateIsCurrent = conversationLoad.conversationId === conversationId;
  const loading = Boolean(conversationId) && (!loadStateIsCurrent || conversationLoad.loading);
  const loadError = conversationId && loadStateIsCurrent ? conversationLoad.error : '';
  const activeOtherUser = !conversationId || loading || loadError ? null : otherUser;
  const isOnline = Boolean(activeOtherUser && onlineUsers.has(activeOtherUser.id));

  useEffect(() => {
    connectSocket(token);
  }, [token]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let active = true;

    async function loadConversation() {
      try {
        const [conversationResponse, messagesResponse] = await Promise.all([
          api.get(`/conversations/${conversationId}`),
          api.get(`/conversations/${conversationId}/messages`),
        ]);
        if (!active) return;

        const other = conversationResponse.data.members.find(
          (member) => member.id !== currentUserId,
        );
        setOtherUser(other || null);
        setMessages((current) => {
          const liveMessages = current.filter(
            (item) => item.conversationId === conversationId,
          );
          const uniqueMessages = new Map(
            [...messagesResponse.data, ...liveMessages].map((item) => [item.id, item]),
          );
          return [...uniqueMessages.values()].sort(
            (first, second) =>
              new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
          );
        });
        setError('');
        setConversationLoad({ conversationId, loading: false, error: '' });
      } catch (requestError) {
        if (active) {
          setConversationLoad({
            conversationId,
            loading: false,
            error:
              requestError.response?.data?.error ||
              'Percakapan belum dapat dimuat. Periksa koneksi lalu coba lagi.',
          });
        }
      }
    }

    loadConversation();
    return () => {
      active = false;
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!socket || !conversationId) return undefined;

    function handleNewMessage(newMessage) {
      setMessages((current) =>
        current.some((item) => item.id === newMessage.id)
          ? current
          : [...current, newMessage],
      );

      if (newMessage.sender?.id !== currentUserId) {
        socket.emit('mark_as_read', {
          conversationId,
          messageId: newMessage.id,
        });
      }
    }
    function handleUserTyping(payload) {
      if (payload.conversationId === conversationId) setOtherTyping(true);
    }
    function handleUserStopTyping(payload) {
      if (payload.conversationId === conversationId) setOtherTyping(false);
    }
    function handleMessageRead({ messageId, readAt }) {
      setMessages((current) =>
        current.map((item) => (item.id === messageId ? { ...item, readAt } : item)),
      );
    }
    function handleMessageError(payload) {
      setError(payload.error || 'Pesan tidak dapat dikirim. Coba lagi.');
    }

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('message_read', handleMessageRead);
    socket.on('message_error', handleMessageError);
    socket.emit('join_conversation', conversationId);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('message_read', handleMessageRead);
      socket.off('message_error', handleMessageError);
      socket.emit('leave_conversation', conversationId);
    };
  }, [conversationId, currentUserId, socket]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, otherTyping]);

  useEffect(() => () => clearTimeout(typingTimeoutRef.current), []);

  function handleTextChange(event) {
    setMessage(event.target.value);
    setError('');
    if (!socket?.connected) return;

    socket.emit('typing_start', { conversationId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId });
    }, 1500);
  }

  function sendMessage(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content) return;
    if (!socket?.connected) {
      setError('Koneksi chat terputus. Tunggu hingga tersambung lalu coba lagi.');
      return;
    }

    socket.emit('send_message', { conversationId, content, type: 'text' });
    socket.emit('typing_stop', { conversationId });
    setMessage('');
    setError('');
  }

  function avatar(name, avatarUrl, className = '') {
    return (
      <span className={className || 'message-avatar'}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : initials(name)}
      </span>
    );
  }

  return (
    <section
      className={`chat-room${conversationId ? ' has-selection' : ' no-selection'}`}
      aria-label="Percakapan"
    >
      <header className="chat-room-header">
        <div className="chat-room-user">
          <button
            className="chat-back-button"
            type="button"
            aria-label="Kembali ke daftar chat"
            onClick={() => navigate('/')}
          >
            <Icon>arrow_back</Icon>
          </button>
          <div className="chat-room-avatar">
            {avatar(activeOtherUser?.name || '', activeOtherUser?.avatarUrl, 'chat-room-avatar-image')}
            {isOnline && <span className="chat-room-online" />}
          </div>
          <div>
            <h2>{activeOtherUser?.name || 'Pilih percakapan'}</h2>
            <p>
              {activeOtherUser
                ? otherTyping
                  ? 'Mengetik...'
                  : isOnline
                    ? 'Online'
                    : 'Offline'
                : 'Chat App'}
            </p>
          </div>
        </div>

        <div className="chat-room-actions">
          <button type="button" title="Pencarian belum tersedia" aria-label="Cari pesan" disabled>
            <Icon>search</Icon>
          </button>
          <button type="button" title="Panggilan belum tersedia" aria-label="Telepon" disabled>
            <Icon>call</Icon>
          </button>
        </div>
      </header>

      <div className="message-thread" ref={threadRef} aria-live="polite">
        {!conversationId && (
          <div className="chat-room-state chat-room-empty-state">
            <Icon>forum</Icon>
            <p>Pilih chat dari daftar untuk melihat pesan.</p>
          </div>
        )}
        {loading && <p className="chat-room-state">Memuat pesan...</p>}
        {!loading && loadError && <p className="chat-room-state chat-room-error" role="alert">{loadError}</p>}
        {conversationId && !loading && error && (
          <p className="chat-room-state chat-room-error" role="alert">{error}</p>
        )}
        {conversationId && !loading && !loadError && !error && messages.length === 0 && (
          <p className="chat-room-state">Belum ada pesan. Mulai percakapan di bawah.</p>
        )}
        {conversationId && !loading && !loadError && messages.map((item) => {
          const isMine = item.sender?.id === currentUserId || item.senderId === currentUserId;
          const time = formatTime(item.createdAt);

          return isMine ? (
            <div className="outgoing-message" key={item.id}>
              <div className="outgoing-bubble">{item.content}</div>
              <div className="outgoing-meta">
                <span>{time}</span>
                <Icon className="checked">{item.readAt ? 'done_all' : 'done'}</Icon>
              </div>
            </div>
          ) : (
            <div className="incoming-message" key={item.id}>
              {avatar(item.sender?.name || otherUser?.name || '', item.sender?.avatarUrl)}
              <div className="incoming-content">
                <div className="incoming-bubble">{item.content}</div>
                <span className="message-time">{time}</span>
              </div>
            </div>
          );
        })}
        {conversationId && otherTyping && <p className="chat-room-typing">{activeOtherUser?.name || 'Kontak'} sedang mengetik...</p>}
      </div>

      <form className="message-input" onSubmit={sendMessage}>
        <div className="message-input-box">
          <input
            type="text"
            placeholder="Ketik pesan..."
            value={message}
            onChange={handleTextChange}
            aria-label="Tulis pesan"
            disabled={!conversationId || loading || !activeOtherUser}
          />
        </div>
        <button
          className="send-button"
          type="submit"
          title="Kirim pesan"
          aria-label="Kirim pesan"
          disabled={!message.trim() || !conversationId || loading || !activeOtherUser}
        >
          <Icon>send</Icon>
        </button>
      </form>
    </section>
  );
}

export default ChatRoom;
