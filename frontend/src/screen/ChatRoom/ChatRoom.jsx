import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import usePreferencesStore from '../../store/preferencesStore';
import { connectSocket, getSocket, subscribeSocket } from '../../services/socket';
import { getMediaUrl } from '../../utils/media';
import { getInitials } from '../../utils/initials';
import ImageLightbox from '../../components/ImageLightbox/ImageLightbox';
import './ChatRoom.css';

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function formatTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getMessagePreview(item) {
  return item.content || item.attachmentName || (item.attachmentUrl ? 'Lampiran' : 'Pesan');
}

function MessageContent({ item, onPreviewImage }) {
  const [downloadError, setDownloadError] = useState('');
  const attachmentUrl = getMediaUrl(item.attachmentUrl);

  async function downloadFile() {
    setDownloadError('');
    try {
      const response = await api.get(attachmentUrl, { responseType: 'blob' });
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = item.attachmentName || 'lampiran';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (requestError) {
      setDownloadError(
        requestError.response?.data?.error || 'File tidak dapat diunduh. Coba lagi.',
      );
    }
  }

  return (
    <>
      {attachmentUrl && item.type === 'image' && (
        <button
          className="message-attachment-image"
          type="button"
          aria-label={`Lihat gambar ${item.attachmentName || 'lampiran'}`}
          onClick={() =>
            onPreviewImage({
              url: attachmentUrl,
              name: item.attachmentName || 'Lampiran gambar',
              caption: item.content,
            })
          }
        >
          <img src={attachmentUrl} alt={item.attachmentName || 'Lampiran gambar'} />
        </button>
      )}
      {attachmentUrl && item.type === 'video' && (
        <video
          className="message-attachment-video"
          src={attachmentUrl}
          controls
          playsInline
          preload="metadata"
          aria-label={item.attachmentName || 'Video dalam pesan'}
        >
          Browser kamu tidak mendukung pemutaran video.
        </video>
      )}
      {attachmentUrl && item.type === 'file' && (
        <button
          className="message-attachment-file"
          type="button"
          onClick={downloadFile}
          aria-label={`Unduh ${item.attachmentName || 'lampiran'}`}
        >
          <Icon>description</Icon>
          <span>{item.attachmentName || 'Unduh lampiran'}</span>
          <Icon>download</Icon>
        </button>
      )}
      {downloadError && <p className="message-attachment-error" role="alert">{downloadError}</p>}
      {item.content && (
        <p className={attachmentUrl ? 'message-caption' : ''}>{item.content}</p>
      )}
    </>
  );
}

function ChatRoom() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const enterToSend = usePreferencesStore((state) => state.preferences.enterToSend);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [conversationLoad, setConversationLoad] = useState({
    conversationId: null,
    loading: true,
    error: '',
  });
  const [otherTyping, setOtherTyping] = useState(false);
  const [error, setError] = useState('');
  const socket = useSyncExternalStore(subscribeSocket, getSocket, getSocket);
  const threadRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const deletedMessageIdsRef = useRef(new Set());
  const messageElementsRef = useRef(new Map());
  const highlightTimeoutRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return undefined;

    function dismissContextMenu(event) {
      if (!event.target.closest('.message-context-menu')) setContextMenu(null);
    }
    function handleContextMenuKey(event) {
      if (event.key === 'Escape') setContextMenu(null);
    }

    document.addEventListener('pointerdown', dismissContextMenu);
    document.addEventListener('keydown', handleContextMenuKey);
    return () => {
      document.removeEventListener('pointerdown', dismissContextMenu);
      document.removeEventListener('keydown', handleContextMenuKey);
    };
  }, [contextMenu]);

  useEffect(() => () => clearTimeout(highlightTimeoutRef.current), []);

  const loadStateIsCurrent = conversationLoad.conversationId === conversationId;
  const loading = Boolean(conversationId) && (!loadStateIsCurrent || conversationLoad.loading);
  const loadError = conversationId && loadStateIsCurrent ? conversationLoad.error : '';
  const activeOtherUser = !conversationId || loading || loadError ? null : otherUser;
  const canCompose = Boolean(conversationId && !loading && activeOtherUser);
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
            [...messagesResponse.data, ...liveMessages]
              .filter((item) => !deletedMessageIdsRef.current.has(item.id))
              .map((item) => [item.id, item]),
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
      if (newMessage.conversationId !== conversationId) return;

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

        const preferences = usePreferencesStore.getState().preferences;
        if (
          document.hidden &&
          preferences.notificationsEnabled &&
          !preferences.doNotDisturb &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(newMessage.sender?.name || 'Pesan baru', {
              body: preferences.messagePreview
                ? newMessage.content || 'Mengirim lampiran'
                : 'Kamu menerima pesan baru.',
              silent: !preferences.notificationSound,
            });
          } catch {
            // Browser notification support varies by platform.
          }
        }
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
    function handleMessageDeleted({ messageId, conversationId: deletedConversationId }) {
      if (deletedConversationId !== conversationId) return;
      deletedMessageIdsRef.current.add(messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
    }
    function handleMessageError(payload) {
      setError(payload.error || 'Pesan tidak dapat dikirim. Coba lagi.');
    }

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('message_read', handleMessageRead);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_error', handleMessageError);
    socket.emit('join_conversation', conversationId);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('message_read', handleMessageRead);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_error', handleMessageError);
    };
  }, [conversationId, currentUserId, socket]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, otherTyping]);

  useEffect(() => () => {
    clearTimeout(typingTimeoutRef.current);
    if (typingActiveRef.current && socket?.connected && conversationId) {
      socket.emit('typing_stop', { conversationId });
    }
    typingActiveRef.current = false;
  }, [conversationId, socket]);

  function handleTextChange(event) {
    setMessage(event.target.value);
    setError('');
    if (!socket?.connected) return;

    if (!typingActiveRef.current) {
      socket.emit('typing_start', { conversationId });
      typingActiveRef.current = true;
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (typingActiveRef.current && socket.connected) {
        socket.emit('typing_stop', { conversationId });
      }
      typingActiveRef.current = false;
    }, 1500);
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content && !selectedAttachment) return;
    setError('');

    if (selectedAttachment) {
      clearTimeout(typingTimeoutRef.current);
      if (typingActiveRef.current && socket?.connected) {
        socket.emit('typing_stop', { conversationId });
      }
      typingActiveRef.current = false;
      const formData = new FormData();
      formData.append('file', selectedAttachment);
      formData.append('caption', content);
      if (replyTo) formData.append('replyToMessageId', replyTo.id);
      setIsUploading(true);
      try {
        const response = await api.post(
          `/conversations/${conversationId}/messages/attachments`,
          formData,
        );
        setMessages((current) =>
          current.some((item) => item.id === response.data.id)
            ? current
            : [...current, response.data],
        );
        setSelectedAttachment(null);
        setMessage('');
        setReplyTo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (requestError) {
        setError(
          requestError.response?.data?.error || 'Lampiran tidak dapat dikirim. Coba lagi.',
        );
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!socket?.connected) {
      setError('Koneksi chat terputus. Tunggu hingga tersambung lalu coba lagi.');
      return;
    }

    clearTimeout(typingTimeoutRef.current);
    if (typingActiveRef.current) {
      socket.emit('typing_stop', { conversationId });
      typingActiveRef.current = false;
    }
    socket.emit('send_message', {
      conversationId,
      content,
      type: 'text',
      replyToMessageId: replyTo?.id,
    });
    setMessage('');
    setReplyTo(null);
  }

  function openMessageMenu(event, item) {
    event.preventDefault();
    const menuWidth = 190;
    const menuHeight = item.senderId === currentUserId ? 100 : 56;
    setContextMenu({
      item,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  }

  function startReply(item) {
    setReplyTo(item);
    setContextMenu(null);
    messageInputRef.current?.focus();
  }

  function navigateToMessage(messageId) {
    const messageElement = messageElementsRef.current.get(messageId);
    if (!messageElement) return;

    clearTimeout(highlightTimeoutRef.current);
    setHighlightedMessageId(messageId);
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1600);
  }

  async function deleteMessage(messageId) {
    if (!window.confirm('Hapus pesan ini untuk semua orang?')) return;
    setError('');
    try {
      await api.delete(`/conversations/${conversationId}/messages/${messageId}`);
      deletedMessageIdsRef.current.add(messageId);
      setMessages((current) => current.filter((item) => item.id !== messageId));
      setContextMenu(null);
      if (replyTo?.id === messageId) setReplyTo(null);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Pesan tidak dapat dihapus. Coba lagi.');
    }
  }

  function insertEmoji(emoji) {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? message.length;
    const end = input?.selectionEnd ?? message.length;
    const nextMessage = `${message.slice(0, start)}${emoji}${message.slice(end)}`;
    setMessage(nextMessage);
    setError('');
    setIsEmojiPickerOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function handleAttachmentChange(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    setSelectedAttachment(file);
    setIsEmojiPickerOpen(false);
    setError('');
  }

  function avatar(name, avatarUrl, className = '') {
    return (
      <span className={className || 'message-avatar'}>
        {avatarUrl ? <img src={getMediaUrl(avatarUrl)} alt="" /> : getInitials(name)}
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
            <div
              className={`outgoing-message${highlightedMessageId === item.id ? ' message-highlight' : ''}`}
              key={item.id}
              ref={(element) => {
                if (element) messageElementsRef.current.set(item.id, element);
                else messageElementsRef.current.delete(item.id);
              }}
              onContextMenu={(event) => openMessageMenu(event, item)}
            >
              <div className={`outgoing-bubble${['image', 'video'].includes(item.type) ? ' has-media-attachment' : ''}`}>
                {item.replyTo && (
                  <button
                    className="message-reply-preview"
                    type="button"
                    aria-label={`Lompat ke pesan dari ${item.replyTo.sender?.name || 'pengirim'}`}
                    onClick={() => navigateToMessage(item.replyTo.id)}
                  >
                    <strong>{item.replyTo.sender?.name || 'Pesan'}</strong>
                    <span>{getMessagePreview(item.replyTo)}</span>
                  </button>
                )}
                <MessageContent item={item} onPreviewImage={setPreviewImage} />
              </div>
              <div className="outgoing-meta">
                <span>{time}</span>
                <Icon className="checked">{item.readAt ? 'done_all' : 'done'}</Icon>
              </div>
            </div>
          ) : (
            <div
              className={`incoming-message${highlightedMessageId === item.id ? ' message-highlight' : ''}`}
              key={item.id}
              ref={(element) => {
                if (element) messageElementsRef.current.set(item.id, element);
                else messageElementsRef.current.delete(item.id);
              }}
              onContextMenu={(event) => openMessageMenu(event, item)}
            >
              {avatar(item.sender?.name || otherUser?.name || '', item.sender?.avatarUrl)}
              <div className="incoming-content">
                <div className="incoming-bubble">
                  {item.replyTo && (
                    <button
                      className="message-reply-preview"
                      type="button"
                      aria-label={`Lompat ke pesan dari ${item.replyTo.sender?.name || 'pengirim'}`}
                      onClick={() => navigateToMessage(item.replyTo.id)}
                    >
                      <strong>{item.replyTo.sender?.name || 'Pesan'}</strong>
                      <span>{getMessagePreview(item.replyTo)}</span>
                    </button>
                  )}
                  <MessageContent item={item} onPreviewImage={setPreviewImage} />
                </div>
                <span className="message-time">{time}</span>
              </div>
            </div>
          );
        })}
        {conversationId && otherTyping && <p className="chat-room-typing">{activeOtherUser?.name || 'Kontak'} sedang mengetik...</p>}
      </div>

      {contextMenu && (
        <div
          className="message-context-menu"
          role="menu"
          aria-label="Aksi pesan"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button type="button" role="menuitem" onClick={() => startReply(contextMenu.item)}>
            <Icon>reply</Icon>
            <span>Balas</span>
          </button>
          {(contextMenu.item.sender?.id === currentUserId ||
            contextMenu.item.senderId === currentUserId) && (
            <button
              className="message-context-delete"
              type="button"
              role="menuitem"
              onClick={() => deleteMessage(contextMenu.item.id)}
            >
              <Icon>delete</Icon>
              <span>Hapus</span>
            </button>
          )}
        </div>
      )}

      <form className="message-input" onSubmit={sendMessage}>
        <div className="message-action-group">
          <input
            ref={fileInputRef}
            className="attachment-file-input"
            type="file"
            accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,.mp4,.webm,.ogv,.mov,.m4v,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={handleAttachmentChange}
            aria-label="Pilih file atau gambar"
          />
          <button
            className="message-action-button"
            type="button"
            title="Tambahkan file atau gambar"
            aria-label="Tambahkan file atau gambar"
            disabled={!canCompose || isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon>add</Icon>
          </button>
          <div className="emoji-picker-wrapper">
            <button
              className="message-action-button"
              type="button"
              title="Pilih emoji"
              aria-label="Pilih emoji"
              aria-expanded={isEmojiPickerOpen}
              disabled={!canCompose || isUploading}
              onClick={() => setIsEmojiPickerOpen((open) => !open)}
            >
              <Icon>sentiment_satisfied</Icon>
            </button>
            {isEmojiPickerOpen && (
              <div className="emoji-picker" role="group" aria-label="Pilih emoji">
                {['😀', '😂', '🥰', '😍', '😊', '😉', '😭', '😎', '👍', '🙏', '❤️', '🎉'].map(
                  (emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`Sisipkan ${emoji}`}
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
        <div className={`message-input-box${selectedAttachment || replyTo ? ' has-attachment' : ''}`}>
          {replyTo && (
            <div className="reply-composer-preview">
              <div>
                <strong>Membalas {replyTo.sender?.name || 'pesan'}</strong>
                <span>{getMessagePreview(replyTo)}</span>
              </div>
              <button
                type="button"
                aria-label="Batal membalas"
                title="Batal membalas"
                onClick={() => setReplyTo(null)}
              >
                <Icon>close</Icon>
              </button>
            </div>
          )}
          {selectedAttachment && (
            <div className="attachment-preview">
              <Icon>
                {selectedAttachment.type.startsWith('image/')
                  ? 'image'
                  : selectedAttachment.type.startsWith('video/') ||
                      /\.mp4$/i.test(selectedAttachment.name)
                    ? 'movie'
                    : 'description'}
              </Icon>
              <span title={selectedAttachment.name}>{selectedAttachment.name}</span>
              <button
                type="button"
                aria-label="Hapus lampiran"
                title="Hapus lampiran"
                onClick={() => {
                  setSelectedAttachment(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <Icon>close</Icon>
              </button>
            </div>
          )}
          <textarea
            ref={messageInputRef}
            placeholder="Ketik pesan..."
            value={message}
            onChange={handleTextChange}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
                event.preventDefault();
                sendMessage(event);
              }
            }}
            aria-label="Tulis pesan"
            disabled={!canCompose || isUploading}
          />
        </div>
        <button
          className="send-button"
          type="submit"
          title="Kirim pesan"
          aria-label="Kirim pesan"
          disabled={(!message.trim() && !selectedAttachment) || !canCompose || isUploading}
        >
          <Icon>{isUploading ? 'hourglass_top' : 'send'}</Icon>
        </button>
      </form>
      {previewImage && (
        <ImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </section>
  );
}

export default ChatRoom;
