import './ConversationList.css';
import { getMediaUrl } from '../../utils/media';
import { getInitials } from '../../utils/initials';

const avatarColors = [
  '#f3b69f',
  '#d6a781',
  '#90a8c6',
  '#8cc7c0',
  '#d1b9ff',
];

function formatConversationTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (first, second) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();

  if (isSameDay(date, today)) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (isSameDay(date, yesterday)) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function getLastMessagePreview(conversation, currentUserId) {
  if (conversation.isIncomingContactRequest) return 'Permintaan kontak · Buka untuk simpan atau buang';
  if (conversation.isOutgoingContactRequest) return 'Menunggu konfirmasi kontak';
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) return 'Belum ada pesan';

  const mediaLabel = {
    image: '📷 Foto',
    video: '🎬 Video',
    file: '📎 File',
  }[lastMessage.type];
  const messagePreview = mediaLabel
    ? `${mediaLabel}${lastMessage.content ? `: ${lastMessage.content}` : ''}`
    : lastMessage.content || '';
  const senderId = lastMessage.sender?.id || lastMessage.senderId;
  if (!senderId) return messagePreview;

  const senderName =
    senderId === currentUserId
      ? 'Anda'
      : lastMessage.sender?.name ||
        conversation.members?.find((member) => member.id === senderId)?.name;

  return senderName ? `${senderName}: ${messagePreview}` : messagePreview;
}

function ConversationList({
  conversations,
  currentUserId,
  loading,
  onlineUsers,
  onOpen,
  query,
  selectedConversationId,
}) {
  if (loading) {
    return <p className="chat-list-state">Memuat percakapan...</p>;
  }

  if (conversations.length === 0) {
    return (
      <div className="chat-list-state chat-list-empty">
        <span className="material-symbols-outlined" aria-hidden="true">
          {query ? 'search_off' : 'forum'}
        </span>
        <p>
          {query
            ? 'Tidak ada percakapan yang cocok dengan pencarian.'
            : 'Belum ada percakapan. Mulai chat baru dari kontak kamu.'}
        </p>
      </div>
    );
  }

  return (
    <div className="conversation-items">
      {conversations.map((conversation) => {
        const otherMember =
          conversation.members?.find((member) => member.id !== currentUserId) ||
          conversation.members?.[0];
        const displayName = otherMember?.name || conversation.name || 'Group chat';
        const avatarColor = avatarColors[displayName.length % avatarColors.length];
        const isBlockedByOther = conversation.type === 'direct' && conversation.isBlockedByOther;
        const isPendingContactRequest = conversation.type === 'direct' &&
          (conversation.isIncomingContactRequest || conversation.isOutgoingContactRequest);
        const isOnline = Boolean(
          !isBlockedByOther && !isPendingContactRequest &&
          otherMember && onlineUsers.has(otherMember.id),
        );

        return (
          <button
            key={conversation.conversationId}
            className={`chat-row${conversation.conversationId === selectedConversationId ? ' active' : ''}`}
            type="button"
            onClick={() => onOpen(conversation.conversationId)}
          >
            <span
              className={`avatar${isOnline ? ' online' : ''}${isBlockedByOther ? ' blocked' : ''}${conversation.isOutgoingContactRequest && !isBlockedByOther ? ' pending-contact' : ''}`}
              style={{
                '--avatar-start': avatarColor,
              }}
            >
              {isBlockedByOther ? (
                <span
                  className="material-symbols-outlined chat-list-blocked-icon"
                  aria-label="Anda diblokir oleh kontak ini"
                  title="Anda diblokir oleh kontak ini"
                >
                  block
                </span>
              ) : conversation.isOutgoingContactRequest ? (
                <span
                  className="chat-list-pending-icon"
                  aria-label="Permintaan kontak belum disimpan"
                  title="Permintaan kontak belum disimpan"
                >
                  ?
                </span>
              ) : otherMember?.avatarUrl ? (
                <img src={getMediaUrl(otherMember.avatarUrl)} alt="" />
              ) : (
                getInitials(displayName)
              )}
            </span>

            <span className="chat-copy">
              <span className="chat-topline">
                <span className="chat-name">
                  {displayName}
                  {conversation.isPinned && (
                    <span className="material-symbols-outlined chat-favorite-icon" aria-label="Favorit">
                      star
                    </span>
                  )}
                </span>
                <span className="chat-time">
                  {formatConversationTime(conversation.lastMessage?.createdAt)}
                </span>
              </span>

              <span className="chat-bottomline">
                <span className="chat-preview">
                  {getLastMessagePreview(conversation, currentUserId)}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ConversationList;
