import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import usePreferencesStore from '../../store/preferencesStore';
import { connectSocket, getSocket, subscribeSocket } from '../../services/socket';
import { getMediaUrl } from '../../utils/media';
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

function MessageContent({ item, onPreviewImage }) {
  const backendOrigin = api.defaults.baseURL.replace(/\/api\/?$/, '');
  const attachmentUrl = item.attachmentUrl ? `${backendOrigin}${item.attachmentUrl}` : '';

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
      {attachmentUrl && item.type === 'file' && (
        <a
          className="message-attachment-file"
          href={attachmentUrl}
          target="_blank"
          rel="noreferrer"
          download={item.attachmentName || true}
        >
          <Icon>description</Icon>
          <span>{item.attachmentName || 'Unduh lampiran'}</span>
        </a>
      )}
      {item.content && (
        <p className={attachmentUrl ? 'message-caption' : ''}>{item.content}</p>
      )}
    </>
  );
}

function ImageLightbox({ image, onClose }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const viewerRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  function setZoom(scale) {
    const nextScale = Math.min(4, Math.max(1, scale));
    setView((current) => ({
      scale: nextScale,
      x: nextScale === 1 ? 0 : current.x,
      y: nextScale === 1 ? 0 : current.y,
    }));
  }

  function handleWheel(event) {
    event.preventDefault();
    setZoom(view.scale + (event.deltaY < 0 ? 0.2 : -0.2));
  }

  function handlePointerDown(event) {
    if (view.scale <= 1 || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, ...view };
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const bounds = viewerRef.current?.getBoundingClientRect();
    const maxX = bounds ? bounds.width * (view.scale - 1) / 2 + 48 : Infinity;
    const maxY = bounds ? bounds.height * (view.scale - 1) / 2 + 48 : Infinity;
    const nextX = dragRef.current.x + event.clientX - dragRef.current.pointerX;
    const nextY = dragRef.current.y + event.clientY - dragRef.current.pointerY;

    setView((current) => ({
      ...current,
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    }));
  }

  function stopDragging() {
    dragRef.current = null;
    setIsDragging(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="image-lightbox"
      aria-label={`Pratinjau gambar: ${image.name}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="image-lightbox-header">
        <div className="image-lightbox-file">
          <Icon>image</Icon>
          <span title={image.name}>{image.name}</span>
        </div>
        <div className="image-lightbox-tools" aria-label="Kontrol gambar">
          <button
            type="button"
            aria-label="Perkecil gambar"
            title="Perkecil"
            disabled={view.scale <= 1}
            onClick={() => setZoom(view.scale - 0.5)}
          >
            <Icon>remove</Icon>
          </button>
          <button
            className="image-lightbox-zoom-level"
            type="button"
            aria-label="Atur ulang zoom"
            title="Atur ulang"
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          >
            {Math.round(view.scale * 100)}%
          </button>
          <button
            type="button"
            aria-label="Perbesar gambar"
            title="Perbesar"
            disabled={view.scale >= 4}
            onClick={() => setZoom(view.scale + 0.5)}
          >
            <Icon>add</Icon>
          </button>
        </div>
        <button
          ref={closeButtonRef}
          className="image-lightbox-close"
          type="button"
          aria-label="Tutup pratinjau gambar"
          title="Tutup"
          onClick={onClose}
        >
          <Icon>close</Icon>
        </button>
      </header>
      <div
        ref={viewerRef}
        className={`image-lightbox-content${isDragging ? ' is-dragging' : ''}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
      >
        <img
          src={image.url}
          alt={image.name}
          draggable="false"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
        {image.caption && <p>{image.caption}</p>}
      </div>
      <p className="image-lightbox-hint">Scroll untuk zoom · Seret untuk menggeser · Klik persentase untuk reset</p>
    </dialog>,
    document.body,
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

  async function sendMessage(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content && !selectedAttachment) return;
    setError('');

    if (selectedAttachment) {
      if (socket?.connected) socket.emit('typing_stop', { conversationId });
      const formData = new FormData();
      formData.append('file', selectedAttachment);
      formData.append('caption', content);
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

    socket.emit('typing_stop', { conversationId });
    socket.emit('send_message', { conversationId, content, type: 'text' });
    setMessage('');
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
        {avatarUrl ? <img src={getMediaUrl(avatarUrl)} alt="" /> : initials(name)}
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
              <div className={`outgoing-bubble${item.type === 'image' ? ' has-image-attachment' : ''}`}>
                <MessageContent item={item} onPreviewImage={setPreviewImage} />
              </div>
              <div className="outgoing-meta">
                <span>{time}</span>
                <Icon className="checked">{item.readAt ? 'done_all' : 'done'}</Icon>
              </div>
            </div>
          ) : (
            <div className="incoming-message" key={item.id}>
              {avatar(item.sender?.name || otherUser?.name || '', item.sender?.avatarUrl)}
              <div className="incoming-content">
                <div className="incoming-bubble">
                  <MessageContent item={item} onPreviewImage={setPreviewImage} />
                </div>
                <span className="message-time">{time}</span>
              </div>
            </div>
          );
        })}
        {conversationId && otherTyping && <p className="chat-room-typing">{activeOtherUser?.name || 'Kontak'} sedang mengetik...</p>}
      </div>

      <form className="message-input" onSubmit={sendMessage}>
        <div className="message-action-group">
          <input
            ref={fileInputRef}
            className="attachment-file-input"
            type="file"
            accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
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
        <div className={`message-input-box${selectedAttachment ? ' has-attachment' : ''}`}>
          {selectedAttachment && (
            <div className="attachment-preview">
              <Icon>{selectedAttachment.type.startsWith('image/') ? 'image' : 'description'}</Icon>
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
