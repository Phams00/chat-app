import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { getSocket } from '../../services/socket';

function ChatRoom() {
  const { id: conversationId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();
  const socket = getSocket();
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    if (!socket) return;

    socket.emit('join_conversation', conversationId);

    function handleNewMessage(msg) {
      setMessages((prev) => [...prev, msg]);
      // Auto mark-as-read kalau pesan ini bukan dari kita sendiri
      if (msg.sender.id !== currentUserId) {
        socket.emit('mark_as_read', { conversationId, messageId: msg.id });
      }
    }

    function handleUserTyping() { setOtherTyping(true); }
    function handleUserStopTyping() { setOtherTyping(false); }

    function handleMessageRead({ messageId, readAt }) {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, readAt } : m))
      );
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
    };
  }, [conversationId]);

  async function fetchHistory() {
    const res = await api.get(`/conversations/${conversationId}/messages`);
    setMessages(res.data);
  }

  function handleTextChange(e) {
    setText(e.target.value);
    if (!socket) return;

    socket.emit('typing_start', { conversationId });

    // Debounce: kalau user berhenti ngetik 1.5 detik, kirim typing_stop
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId });
    }, 1500);
  }

  function handleSend() {
    if (!text.trim() || !socket) return;
    socket.emit('send_message', { conversationId, content: text, type: 'text' });
    socket.emit('typing_stop', { conversationId });
    setText('');
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '1rem' }}>
      <button onClick={() => navigate('/')}>← Kembali</button>
      <div style={{ height: 400, overflowY: 'auto', border: '1px solid #eee', padding: 8, margin: '8px 0' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ textAlign: msg.sender.id === currentUserId ? 'right' : 'left', margin: '4px 0' }}>
            <span style={{ background: msg.sender.id === currentUserId ? '#dcf8c6' : '#f1f1f1', padding: '6px 10px', borderRadius: 10, display: 'inline-block' }}>
              {msg.content}
            </span>
            {msg.sender.id === currentUserId && (
              <div style={{ fontSize: 11, color: msg.readAt ? '#34b7f1' : 'gray' }}>
                {msg.readAt ? '✓✓ Dibaca' : '✓ Terkirim'}
              </div>
            )}
          </div>
        ))}
        {otherTyping && <p style={{ color: 'gray', fontStyle: 'italic', fontSize: 13 }}>Sedang mengetik...</p>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={handleTextChange} style={{ flex: 1, padding: 8 }} placeholder="Ketik pesan" />
        <button onClick={handleSend}>Kirim</button>
      </div>
    </div>
  );
}

export default ChatRoom;