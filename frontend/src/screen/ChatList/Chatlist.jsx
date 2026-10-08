import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationList from '../../components/ConversationList/ConversationList';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import './ChatList.css';

function ChatList() {
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const navigate = useNavigate();
  const { id: selectedConversationId } = useParams();

  useEffect(() => {
    connectSocket(token);
    let active = true;

    api.get('/conversations')
      .then((response) => {
        if (active) setConversations(response.data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error ||
              'Percakapan belum dapat dimuat. Periksa koneksi lalu coba lagi.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    function handleNewMessage(message) {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.conversationId === message.conversationId
            ? { ...conversation, lastMessage: message }
            : conversation,
        )
        .sort((first, second) => {
          const firstTime = new Date(first.lastMessage?.createdAt || 0).getTime();
          const secondTime = new Date(second.lastMessage?.createdAt || 0).getTime();
          return secondTime - firstTime;
        }),
    );
    }

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, []);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id');
    if (!normalizedQuery) return conversations;

    return conversations.filter((conversation) => {
      const memberNames = conversation.members
        .map((member) => member.name || '')
        .join(' ');
      const lastMessage = conversation.lastMessage?.content || '';
      return `${memberNames} ${lastMessage}`
        .toLocaleLowerCase('id')
        .includes(normalizedQuery);
    });
  }, [conversations, query]);

  return (
    <aside
      className={`chat-list${selectedConversationId ? ' has-selection' : ''}`}
      aria-label="Daftar percakapan"
    >
      <div className="chat-list-header">
        <div className="chat-list-title-row">
          <div className="chat-list-title">
            <span>Pesan</span>
            <span className="chat-count">{conversations.length}</span>
          </div>

          <button
            className="new-chat-button"
            type="button"
            title="Pilih kontak"
            aria-label="Mulai chat dari kontak"
            onClick={() => navigate('/contacts')}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit_square
            </span>
          </button>
        </div>

        <label className="chat-search">
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            placeholder="Cari pesan atau kontak..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Cari percakapan"
          />
        </label>
      </div>

      {error ? (
        <p className="chat-list-state" role="alert">{error}</p>
      ) : (
        <div className="conversation-list">
          <ConversationList
            conversations={filteredConversations}
            currentUserId={currentUserId}
            loading={loading}
            onlineUsers={onlineUsers}
            selectedConversationId={selectedConversationId}
            onOpen={(conversationId) => navigate(`/chats/${conversationId}`)}
            query={query}
          />
        </div>
      )}
    </aside>
  );
}

export default ChatList;
