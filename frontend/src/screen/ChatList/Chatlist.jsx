import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConversationList from '../../components/ConversationList/ConversationList';
import api from '../../services/api';
import { connectSocket, getSocket, subscribeSocket } from '../../services/socket';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import './ChatList.css';

function sortConversations(conversations) {
  return [...conversations].sort((first, second) => {
    if (first.isPinned !== second.isPinned) return first.isPinned ? -1 : 1;
    return new Date(second.lastMessage?.createdAt || 0) -
      new Date(first.lastMessage?.createdAt || 0);
  });
}

function ChatList() {
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const conversationIdsRef = useRef([]);
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const socket = useSyncExternalStore(subscribeSocket, getSocket, getSocket);
  const navigate = useNavigate();
  const { id: selectedConversationId } = useParams();

  useEffect(() => {
    const connectionSocket = connectSocket(token);
    if (!connectionSocket) return undefined;
    let active = true;

    function joinConversations() {
      conversationIdsRef.current.forEach((conversationId) => {
        connectionSocket.emit('join_conversation', conversationId);
      });
    }

    connectionSocket.on('connect', joinConversations);

    api.get('/conversations')
      .then((response) => {
        if (active) {
          setConversations(sortConversations(response.data));
          conversationIdsRef.current = response.data.map(
            (conversation) => conversation.conversationId,
          );
          if (connectionSocket.connected) joinConversations();
        }
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
      connectionSocket.off('connect', joinConversations);
      conversationIdsRef.current.forEach((conversationId) => {
        connectionSocket.emit('leave_conversation', conversationId);
      });
      conversationIdsRef.current = [];
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    function refreshConversations() {
      api.get('/conversations')
        .then((response) => {
          if (!active) return;
          const nextConversationIds = response.data.map(
            (conversation) => conversation.conversationId,
          );
          const nextConversationIdSet = new Set(nextConversationIds);
          conversationIdsRef.current
            .filter((conversationId) => !nextConversationIdSet.has(conversationId))
            .forEach((conversationId) => socket?.emit('leave_conversation', conversationId));
          setConversations(sortConversations(response.data));
          conversationIdsRef.current = nextConversationIds;
          conversationIdsRef.current.forEach((conversationId) => {
            socket?.emit('join_conversation', conversationId);
          });
        })
        .catch((requestError) => {
          if (active) {
            setError(
              requestError.response?.data?.error || 'Daftar chat belum dapat diperbarui.',
            );
          }
        });
    }

    function handleNewMessage(message) {
      setConversations((current) =>
        sortConversations(current
          .map((conversation) =>
            conversation.conversationId === message.conversationId &&
            (!conversation.clearedAt ||
              new Date(message.createdAt) > new Date(conversation.clearedAt))
              ? { ...conversation, lastMessage: message }
              : conversation,
          )),
      );
    }

    function handleMessageDeleted({ conversationId, lastMessage }) {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === conversationId
            ? {
              ...conversation,
              lastMessage: lastMessage && conversation.clearedAt &&
                new Date(lastMessage.createdAt) <= new Date(conversation.clearedAt)
                ? null
                : lastMessage,
            }
            : conversation,
        ),
      );
    }
    function handleConversationFavoriteUpdated({ conversationId, isFavorite }) {
      setConversations((current) => sortConversations(
        current.map((conversation) =>
          conversation.conversationId === conversationId
            ? { ...conversation, isPinned: isFavorite }
            : conversation,
        ),
      ));
    }
    function handleConversationCleared({ conversationId, clearedAt }) {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.conversationId === conversationId
            ? { ...conversation, lastMessage: null, clearedAt }
            : conversation,
        ),
      );
    }
    function handleConversationBlockUpdated({ conversationId }) {
      if (conversationId) refreshConversations();
    }
    function handleConversationRemoved({ conversationId }) {
      if (Array.isArray(conversationId)) {
        const removedConversationIds = new Set(conversationId);
        setConversations((current) =>
          current.filter(({ conversationId: id }) => !removedConversationIds.has(id)),
        );
        return;
      }
      if (!conversationId) return;
      setConversations((current) =>
        current.filter((conversation) => conversation.conversationId !== conversationId),
      );
    }
    function handleContactRemoved({ contactUserId, conversationIds = [] }) {
      const removedConversationIds = new Set(conversationIds);
      setConversations((current) =>
        current.filter((conversation) =>
          !removedConversationIds.has(conversation.conversationId) &&
          !conversation.members.some((member) => member.id === contactUserId),
        ),
      );
    }
    function handleLocalConversationRemoved(event) {
      handleContactRemoved(event.detail);
    }

    socket?.on('new_message', handleNewMessage);
    socket?.on('message_deleted', handleMessageDeleted);
    socket?.on('conversation_favorite_updated', handleConversationFavoriteUpdated);
    socket?.on('conversation_cleared', handleConversationCleared);
    socket?.on('conversation_block_updated', handleConversationBlockUpdated);
    socket?.on('conversation_removed', handleConversationRemoved);
    socket?.on('contact_removed', handleContactRemoved);
    socket?.on('conversation_list_changed', refreshConversations);
    socket?.on('contact_request_received', refreshConversations);
    socket?.on('conversation_contact_updated', refreshConversations);
    window.addEventListener('conversation-removed', handleLocalConversationRemoved);
    return () => {
      active = false;
      socket?.off('new_message', handleNewMessage);
      socket?.off('message_deleted', handleMessageDeleted);
      socket?.off('conversation_favorite_updated', handleConversationFavoriteUpdated);
      socket?.off('conversation_cleared', handleConversationCleared);
      socket?.off('conversation_block_updated', handleConversationBlockUpdated);
      socket?.off('conversation_removed', handleConversationRemoved);
      socket?.off('contact_removed', handleContactRemoved);
      socket?.off('conversation_list_changed', refreshConversations);
      socket?.off('contact_request_received', refreshConversations);
      socket?.off('conversation_contact_updated', refreshConversations);
      window.removeEventListener('conversation-removed', handleLocalConversationRemoved);
    };
  }, [socket]);

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
