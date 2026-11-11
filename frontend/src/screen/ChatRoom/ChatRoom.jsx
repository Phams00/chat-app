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
  const [conversationType, setConversationType] = useState(null);
  const [conversationSettings, setConversationSettings] = useState({
    isFavorite: false,
    isBlockedByMe: false,
    isBlockedByOther: false,
    isContactSavedByMe: false,
    isContactSavedByOther: false,
    isIncomingContactRequest: false,
    isOutgoingContactRequest: false,
  });
  const [contactProfile, setContactProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
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
  const clearedAtRef = useRef(null);
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
  const canCompose = Boolean(
    conversationId && !loading && activeOtherUser &&
    !conversationSettings.isBlockedByMe &&
    !conversationSettings.isBlockedByOther,
  );
  const isOnline = Boolean(
    activeOtherUser &&
    conversationSettings.isContactSavedByMe &&
    conversationSettings.isContactSavedByOther &&
    onlineUsers.has(activeOtherUser.id),
  );

  useEffect(() => {
    connectSocket(token);
  }, [token]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let active = true;
    clearedAtRef.current = null;

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
        setConversationType(conversationResponse.data.type);
        setProfileOpen(false);
        setContactProfile(null);
        const clearedAt = clearedAtRef.current || conversationResponse.data.clearedAt;
        clearedAtRef.current = clearedAt;
        setOtherUser(other || null);
        setConversationSettings({
          isFavorite: conversationResponse.data.isFavorite,
          isBlockedByMe: conversationResponse.data.isBlockedByMe,
          isBlockedByOther: conversationResponse.data.isBlockedByOther,
          isContactSavedByMe: conversationResponse.data.isContactSavedByMe,
          isContactSavedByOther: conversationResponse.data.isContactSavedByOther,
          isIncomingContactRequest: conversationResponse.data.isIncomingContactRequest,
          isOutgoingContactRequest: conversationResponse.data.isOutgoingContactRequest,
        });
        setMessages((current) => {
          const liveMessages = current.filter(
            (item) => item.conversationId === conversationId,
          );
          const uniqueMessages = new Map(
            [...messagesResponse.data, ...liveMessages]
              .filter((item) =>
                !deletedMessageIdsRef.current.has(item.id) &&
                (!clearedAt || new Date(item.createdAt) > new Date(clearedAt)),
              )
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
      if (
        clearedAtRef.current &&
        new Date(newMessage.createdAt) <= new Date(clearedAtRef.current)
      ) return;

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
    async function handleConversationBlockUpdated(payload) {
      if (payload.conversationId !== conversationId) return;
      setOtherTyping(false);
      try {
        const response = await api.get(`/conversations/${conversationId}`);
        setConversationSettings({
          isFavorite: response.data.isFavorite,
          isBlockedByMe: response.data.isBlockedByMe,
          isBlockedByOther: response.data.isBlockedByOther,
          isContactSavedByMe: response.data.isContactSavedByMe,
          isContactSavedByOther: response.data.isContactSavedByOther,
          isIncomingContactRequest: response.data.isIncomingContactRequest,
          isOutgoingContactRequest: response.data.isOutgoingContactRequest,
        });
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Info blokir belum dapat diperbarui.');
      }
    }
    async function handleConversationContactUpdated(payload) {
      if (payload.conversationId !== conversationId) return;
      try {
        const response = await api.get(`/conversations/${conversationId}`);
        const updatedOtherUser = response.data.members.find(
          (member) => member.id !== currentUserId,
        );
        setOtherUser(updatedOtherUser || null);
        setConversationSettings((current) => ({
          ...current,
          isContactSavedByMe: response.data.isContactSavedByMe,
          isContactSavedByOther: response.data.isContactSavedByOther,
          isIncomingContactRequest: response.data.isIncomingContactRequest,
          isOutgoingContactRequest: response.data.isOutgoingContactRequest,
        }));
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Permintaan kontak belum diperbarui.');
      }
    }
    function handleConversationCleared(payload) {
      if (payload.conversationId !== conversationId) return;
      clearedAtRef.current = payload.clearedAt;
      deletedMessageIdsRef.current.clear();
      setMessages([]);
      setReplyTo(null);
      setSelectedAttachment(null);
      setMessage('');
    }

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('message_read', handleMessageRead);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_error', handleMessageError);
    socket.on('conversation_block_updated', handleConversationBlockUpdated);
    socket.on('conversation_contact_updated', handleConversationContactUpdated);
    socket.on('conversation_cleared', handleConversationCleared);
    socket.emit('join_conversation', conversationId);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('message_read', handleMessageRead);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_error', handleMessageError);
      socket.off('conversation_block_updated', handleConversationBlockUpdated);
      socket.off('conversation_contact_updated', handleConversationContactUpdated);
      socket.off('conversation_cleared', handleConversationCleared);
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

  async function openContactProfile() {
    if (!activeOtherUser || conversationType !== 'direct') return;
    setProfileOpen(true);
    setContactProfile(null);
    if (!conversationSettings.isContactSavedByMe ||
      !conversationSettings.isContactSavedByOther ||
      conversationSettings.isBlockedByMe ||
      conversationSettings.isBlockedByOther) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const response = await api.get(`/profile/${activeOtherUser.id}`);
      setContactProfile(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Info kontak belum dapat dimuat.');
    } finally {
      setProfileLoading(false);
    }
  }

  async function toggleFavorite() {
    if (actionInProgress) return;
    const isFavorite = !conversationSettings.isFavorite;
    setActionInProgress(true);
    setError('');
    try {
      await api.patch(`/conversations/${conversationId}/favorite`, { isFavorite });
      setConversationSettings((current) => ({ ...current, isFavorite }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Favorit belum dapat diperbarui.');
    } finally {
      setActionInProgress(false);
    }
  }

  async function toggleBlock() {
    if (!activeOtherUser || actionInProgress) return;
    const isBlocked = !conversationSettings.isBlockedByMe;
    const action = isBlocked ? 'memblokir' : 'membuka blokir';
    if (!window.confirm(`Yakin ingin ${action} ${activeOtherUser.name}?`)) return;
    setActionInProgress(true);
    setError('');
    try {
      const response = await api.patch(`/conversations/${conversationId}/block`, { isBlocked });
      setConversationSettings({
        isFavorite: response.data.isFavorite,
        isBlockedByMe: response.data.isBlockedByMe,
        isBlockedByOther: response.data.isBlockedByOther,
        isContactSavedByMe: response.data.isContactSavedByMe,
        isContactSavedByOther: response.data.isContactSavedByOther,
        isIncomingContactRequest: response.data.isIncomingContactRequest,
        isOutgoingContactRequest: response.data.isOutgoingContactRequest,
      });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Status blokir belum dapat diperbarui.');
    } finally {
      setActionInProgress(false);
    }
  }

  async function acceptContactRequest() {
    if (!activeOtherUser || actionInProgress) return;
    setActionInProgress(true);
    setError('');
    try {
      await api.post(`/contacts/${activeOtherUser.id}/accept`);
      setConversationSettings((current) => ({
        ...current,
        isContactSavedByMe: true,
        isContactSavedByOther: true,
        isIncomingContactRequest: false,
        isOutgoingContactRequest: false,
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Kontak belum dapat disimpan.');
    } finally {
      setActionInProgress(false);
    }
  }

  async function discardContactRequest() {
    if (!activeOtherUser || actionInProgress) return;
    if (!window.confirm(`Buang permintaan kontak dari ${activeOtherUser.name}?`)) return;
    setActionInProgress(true);
    setError('');
    try {
      await api.delete(`/contacts/${activeOtherUser.id}/request`);
      window.dispatchEvent(new CustomEvent('conversation-removed', {
        detail: { conversationId, contactUserId: activeOtherUser.id },
      }));
      navigate('/');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Permintaan kontak belum dapat dibuang.');
    } finally {
      setActionInProgress(false);
    }
  }

  async function clearChat() {
    if (actionInProgress || !window.confirm('Hapus semua pesan dari chat ini di akunmu?')) return;
    setActionInProgress(true);
    setError('');
    try {
      const response = await api.delete(`/conversations/${conversationId}/messages`);
      clearedAtRef.current = response.data.clearedAt;
      deletedMessageIdsRef.current.clear();
      setMessages([]);
      setReplyTo(null);
      setSelectedAttachment(null);
      setMessage('');
      setProfileOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Chat belum dapat dibersihkan.');
    } finally {
      setActionInProgress(false);
    }
  }

  async function deleteContact() {
    if (!activeOtherUser || actionInProgress) return;
    if (!window.confirm(
      `Hapus ${activeOtherUser.name} dari kontakmu dan hapus riwayat chat dari akunmu?`,
    )) {
      return;
    }
    setActionInProgress(true);
    setError('');
    try {
      await api.delete(`/contacts/${activeOtherUser.id}`);
      window.dispatchEvent(new CustomEvent('conversation-removed', {
        detail: { conversationId, contactUserId: activeOtherUser.id },
      }));
      setProfileOpen(false);
      navigate('/');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Kontak belum dapat dihapus.');
    } finally {
      setActionInProgress(false);
    }
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
          <button
            className="chat-contact-profile-button"
            type="button"
            onClick={openContactProfile}
            disabled={!activeOtherUser || conversationType !== 'direct'}
            aria-label={`Info kontak ${activeOtherUser?.name || ''}`}
          >
            <span className="chat-room-avatar">
              {conversationSettings.isBlockedByOther ? (
                <span
                  className="chat-room-avatar-image blocked-profile-icon"
                  aria-label="Anda diblokir oleh kontak ini"
                  title="Anda diblokir oleh kontak ini"
                >
                  <Icon>block</Icon>
                </span>
              ) : conversationSettings.isOutgoingContactRequest ? (
                <span
                  className="chat-room-avatar-image pending-profile-icon"
                  aria-label="Permintaan kontak belum disimpan"
                  title="Permintaan kontak belum disimpan"
                >
                  ?
                </span>
              ) : avatar(activeOtherUser?.name || '', activeOtherUser?.avatarUrl, 'chat-room-avatar-image')}
              {isOnline && !conversationSettings.isBlockedByOther &&
                !conversationSettings.isOutgoingContactRequest && (
                <span className="chat-room-online" />
              )}
            </span>
            <span className="chat-room-contact-copy">
              <strong>{activeOtherUser?.name || 'Pilih percakapan'}</strong>
              <span className={
                conversationSettings.isBlockedByOther
                  ? 'is-blocked'
                  : !conversationSettings.isContactSavedByMe ||
                      !conversationSettings.isContactSavedByOther
                    ? 'is-pending'
                    : ''
              }>
                {activeOtherUser
                  ? conversationSettings.isBlockedByOther
                    ? 'Anda telah diblokir'
                    : !conversationSettings.isContactSavedByMe ||
                        !conversationSettings.isContactSavedByOther
                      ? conversationSettings.isOutgoingContactRequest
                        ? 'Menunggu konfirmasi kontak'
                        : 'Permintaan kontak'
                    : otherTyping
                      ? 'Mengetik...'
                      : isOnline
                        ? 'Online'
                        : 'Offline'
                  : 'Chat App'}
              </span>
            </span>
          </button>
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

      {profileOpen && activeOtherUser && (
        <div
          className="contact-profile-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfileOpen(false);
          }}
        >
          <section
            className="chat-contact-profile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-contact-profile-title"
          >
            <header>
              <h2 id="chat-contact-profile-title">Info kontak</h2>
              <button type="button" aria-label="Tutup info kontak" onClick={() => setProfileOpen(false)}>
                <Icon>close</Icon>
              </button>
            </header>
            <div className="chat-contact-profile-details">
              <span className={`chat-contact-profile-avatar${conversationSettings.isBlockedByOther ? ' is-blocked' : conversationSettings.isOutgoingContactRequest ? ' is-pending-contact' : ''}`}>
                {conversationSettings.isBlockedByOther ? (
                  <Icon>block</Icon>
                ) : conversationSettings.isOutgoingContactRequest ? (
                  <span className="pending-profile-question">?</span>
                ) : activeOtherUser?.avatarUrl ? (
                  <img src={getMediaUrl(activeOtherUser.avatarUrl)} alt="" />
                ) : getInitials(activeOtherUser?.name)}
              </span>
              <h3>{activeOtherUser?.name}</h3>
              {profileLoading ? (
                <p>Memuat info kontak...</p>
              ) : !conversationSettings.isContactSavedByMe ||
                !conversationSettings.isContactSavedByOther ||
                conversationSettings.isBlockedByMe ||
                conversationSettings.isBlockedByOther ? (
                <p>Info profil dan status hanya tersedia setelah kontak diterima.</p>
              ) : contactProfile ? (
                <div className="chat-contact-profile-info">
                  {contactProfile.phoneNumber && <p>{contactProfile.phoneNumber}</p>}
                  {contactProfile.username && <p>@{contactProfile.username}</p>}
                  {contactProfile.about && <p>{contactProfile.about}</p>}
                  {contactProfile.link && (
                    <a href={contactProfile.link} target="_blank" rel="noreferrer">
                      {contactProfile.link}
                    </a>
                  )}
                  {!contactProfile.phoneNumber && !contactProfile.username &&
                    !contactProfile.about && !contactProfile.link && (
                      <p>Belum ada info tambahan.</p>
                    )}
                </div>
              ) : <p>Info kontak belum tersedia.</p>}
            </div>
            {!conversationSettings.isIncomingContactRequest &&
              !conversationSettings.isOutgoingContactRequest && (
                <div className="chat-contact-actions">
              <button type="button" disabled={actionInProgress} onClick={toggleFavorite}>
                <Icon>{conversationSettings.isFavorite ? 'star' : 'star_outline'}</Icon>
                {conversationSettings.isFavorite ? 'Hapus favorit' : 'Tambahkan ke favorit'}
              </button>
              <button
                className="chat-contact-danger"
                type="button"
                disabled={actionInProgress}
                onClick={clearChat}
              >
                <Icon>delete_sweep</Icon>
                Hapus chat dari akun ini
              </button>
              <button
                className="chat-contact-danger"
                type="button"
                disabled={actionInProgress}
                onClick={toggleBlock}
              >
                <Icon>{conversationSettings.isBlockedByMe ? 'person_check' : 'block'}</Icon>
                {conversationSettings.isBlockedByMe ? 'Buka blokir kontak' : 'Blokir kontak'}
              </button>
              <button
                className="chat-contact-danger"
                type="button"
                disabled={actionInProgress}
                onClick={deleteContact}
              >
                <Icon>person_remove</Icon>
                Hapus kontak
              </button>
                </div>
              )}
          </section>
        </div>
      )}

      <div className="message-thread" ref={threadRef} aria-live="polite">
        {!conversationId && (
          <div className="chat-room-state chat-room-empty-state">
            <Icon>forum</Icon>
            <p>Pilih chat dari daftar untuk melihat pesan.</p>
          </div>
        )}
        {loading && <p className="chat-room-state">Memuat pesan...</p>}
        {!loading && conversationSettings.isIncomingContactRequest && (
          <div className="chat-contact-request" role="status">
            <p><strong>{activeOtherUser?.name}</strong> menambahkanmu ke kontak.</p>
            <p>Kalian tetap bisa mengirim pesan. Simpan kontak agar dapat melihat info profil dan status.</p>
            <div>
              <button
                type="button"
                disabled={actionInProgress}
                onClick={acceptContactRequest}
              >
                {actionInProgress ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                className="chat-contact-request-discard"
                type="button"
                disabled={actionInProgress}
                onClick={discardContactRequest}
              >
                Buang
              </button>
            </div>
          </div>
        )}
        {!loading && conversationSettings.isOutgoingContactRequest && (
          <p className="chat-contact-request-waiting" role="status">
            Permintaan kontak terkirim. Menunggu {activeOtherUser?.name} menyimpan kontakmu.
          </p>
        )}
        {!loading && (conversationSettings.isBlockedByOther || conversationSettings.isBlockedByMe) && (
          <p className="chat-blocked-notice" role="status">
            {conversationSettings.isBlockedByOther
              ? 'Anda telah diblokir oleh kontak ini. Kalian tidak dapat saling mengirim pesan atau melihat status.'
              : 'Kamu memblokir kontak ini. Kalian tidak dapat saling mengirim pesan atau melihat status.'}
          </p>
        )}
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
              {conversationSettings.isOutgoingContactRequest ? (
                <span className="message-avatar pending-message-avatar" aria-label="Permintaan kontak belum disimpan">?</span>
              ) : avatar(item.sender?.name || otherUser?.name || '', item.sender?.avatarUrl)}
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

      <form className={`message-input${canCompose ? '' : ' is-disabled'}`} onSubmit={sendMessage}>
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
