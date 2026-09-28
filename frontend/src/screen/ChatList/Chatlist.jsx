import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import { connectSocket } from '../../services/socket';

function ChatList() {
  const [conversations, setConversations] = useState([]);
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const navigate = useNavigate();

  useEffect(() => {
    // Jaga-jaga kalau halaman ini dibuka lewat refresh (socket belum ada).
    // connectSocket aman dipanggil berulang karena mengembalikan socket yang sudah ada.
    connectSocket(token);
    fetchConversations();
  }, []);

  async function fetchConversations() {
    const res = await api.get('/conversations');
    setConversations(res.data);
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Chats</h2>
        <div>
          <button onClick={() => navigate('/contacts')}>+ Kontak</button>
          <button onClick={() => navigate('/profile')} style={{ marginLeft: 8 }}>
            Profil
          </button>
        </div>
      </div>

      {conversations.length === 0 && (
        <p style={{ color: 'gray' }}>Belum ada percakapan. Mulai dari menu Kontak.</p>
      )}

      {conversations.map((conv) => {
        // Lawan bicara = anggota yang bukan kita sendiri
        const otherMember = conv.members.find((m) => m.id !== currentUserId);
        const isOnline = otherMember && onlineUsers.has(otherMember.id);

        return (
          <div
            key={conv.conversationId}
            onClick={() => navigate(`/chats/${conv.conversationId}`)}
            style={{ padding: 10, borderBottom: '1px solid #eee', cursor: 'pointer' }}
          >
            <strong>
              {otherMember?.name || 'Grup'}
              {isOnline && (
                <span style={{ color: '#25d366', marginLeft: 6, fontSize: 12 }}>● online</span>
              )}
            </strong>
            <p style={{ margin: 0, color: 'gray', fontSize: 13 }}>
              {conv.lastMessage?.content || 'Belum ada pesan'}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default ChatList;