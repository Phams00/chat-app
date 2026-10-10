import './ConversationList.css';

const avatarColors = [
  ['#f3b69f', '#cd7f5d'],
  ['#d6a781', '#ba8773'],
  ['#90a8c6', '#6d7ea5'],
  ['#8cc7c0', '#5fa7a4'],
  ['#d1b9ff', '#9e82d9'],
];

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

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
        const colorPair = avatarColors[displayName.length % avatarColors.length];
        const isOnline = Boolean(otherMember && onlineUsers.has(otherMember.id));

        return (
          <button
            key={conversation.conversationId}
            className={`chat-row${conversation.conversationId === selectedConversationId ? ' active' : ''}`}
            type="button"
            onClick={() => onOpen(conversation.conversationId)}
          >
            <span
              className={`avatar${isOnline ? ' online' : ''}`}
              style={{
                '--avatar-start': colorPair[0],
                '--avatar-end': colorPair[1],
              }}
            >
              {otherMember?.avatarUrl ? (
                <img src={otherMember.avatarUrl} alt="" />
              ) : (
                initials(displayName)
              )}
            </span>

            <span className="chat-copy">
              <span className="chat-topline">
                <span className="chat-name">{displayName}</span>
                <span className="chat-time">
                  {formatConversationTime(conversation.lastMessage?.createdAt)}
                </span>
              </span>

              <span className="chat-bottomline">
                <span className="chat-preview">
                  {conversation.lastMessage?.content ||
                    (conversation.lastMessage?.type === 'image'
                      ? '📷 Foto'
                      : conversation.lastMessage?.type === 'file'
                        ? '📎 File'
                        : 'Belum ada pesan')}
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
