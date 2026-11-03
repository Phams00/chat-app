import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { connectSocket } from '../../services/socket';
import { getMediaUrl } from '../../utils/media';
import { getInitials } from '../../utils/initials';
import './Status.css';

function formatStatusTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function Status() {
  const [statusGroups, setStatusGroups] = useState({ mine: [], contacts: [] });
  const [selectedStatusId, setSelectedStatusId] = useState(null);
  const [mediaSource, setMediaSource] = useState({ statusId: null, url: '' });
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [error, setError] = useState('');
  const statusesRevisionRef = useRef(0);
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  async function loadStatuses() {
    const response = await api.get('/statuses');
    setStatusGroups(response.data);
  }

  useEffect(() => {
    const socket = connectSocket(token);
    if (!socket) return undefined;
    let active = true;

    function refreshStatuses() {
      const requestRevision = statusesRevisionRef.current;
      api.get('/statuses')
        .then((response) => {
          if (active && requestRevision === statusesRevisionRef.current) {
            setStatusGroups(response.data);
          }
        })
        .catch((requestError) => {
          if (active) {
            setError(requestError.response?.data?.error || 'Pooddle belum dapat dimuat. Coba lagi.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    function handleStatusCreated({ status, user }) {
      if (!status || !user) return;
      statusesRevisionRef.current += 1;

      setStatusGroups((current) => {
        if (user.id === currentUser?.id) {
          const mine = [status, ...current.mine.filter((item) => item.id !== status.id)]
            .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
          return { ...current, mine };
        }

        const existingGroup = current.contacts.find((group) => group.user.id === user.id);
        const nextGroup = {
          user: existingGroup?.user || user,
          statuses: [status, ...(existingGroup?.statuses || []).filter((item) => item.id !== status.id)]
            .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)),
        };
        const contacts = [
          ...current.contacts.filter((group) => group.user.id !== user.id),
          nextGroup,
        ].sort((first, second) =>
          new Date(second.statuses[0].createdAt) - new Date(first.statuses[0].createdAt),
        );
        return { ...current, contacts };
      });
    }

    function handleStatusDeleted({ statusId, userId }) {
      statusesRevisionRef.current += 1;
      setStatusGroups((current) => ({
        mine: current.mine.filter((status) => status.id !== statusId),
        contacts: current.contacts
          .map((group) => ({
            ...group,
            statuses: group.statuses.filter((status) => status.id !== statusId),
          }))
          .filter((group) => group.statuses.length > 0 || group.user.id !== userId),
      }));
      setSelectedStatusId((selectedId) => selectedId === statusId ? null : selectedId);
    }

    function handleContactsChanged() {
      statusesRevisionRef.current += 1;
      refreshStatuses();
    }

    socket.on('status_created', handleStatusCreated);
    socket.on('status_deleted', handleStatusDeleted);
    socket.on('contact_added', handleContactsChanged);
    socket.on('connect', refreshStatuses);
    refreshStatuses();

    return () => {
      active = false;
      socket.off('status_created', handleStatusCreated);
      socket.off('status_deleted', handleStatusDeleted);
      socket.off('contact_added', handleContactsChanged);
      socket.off('connect', refreshStatuses);
    };
  }, [currentUser?.id, token]);

  const allStatuses = useMemo(
    () => [
      ...statusGroups.mine.map((status) => ({ ...status, owner: currentUser, isMine: true })),
      ...statusGroups.contacts.flatMap(({ user, statuses }) =>
        statuses.map((status) => ({ ...status, owner: user, isMine: false })),
      ),
    ],
    [currentUser, statusGroups],
  );
  const selectedStatus = allStatuses.find(({ id }) => id === selectedStatusId);
  const selectedStatusIndex = allStatuses.findIndex(({ id }) => id === selectedStatusId);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    if (!selectedStatus?.mediaUrl) return undefined;

    api.get(selectedStatus.mediaUrl.replace(/^\/api/, ''), { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) setMediaSource({ statusId: selectedStatus.id, url: objectUrl });
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.error || 'Gambar Pooddle tidak dapat dimuat.');
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedStatus?.id, selectedStatus?.mediaUrl]);

  async function publishStatus(event) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData();
    formData.append('content', draft);
    if (file) formData.append('file', file);

    setSubmitting(true);
    setError('');
    try {
      const response = await api.post('/statuses', formData);
      await loadStatuses();
      setSelectedStatusId(response.data.id);
      setDraft('');
      setFile(null);
      setComposerOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Pooddle tidak dapat dibagikan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStatus() {
    if (!selectedStatus?.isMine) return;
    setError('');
    try {
      await api.delete(`/statuses/${selectedStatus.id}`);
      setSelectedStatusId(null);
      await loadStatuses();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Pooddle tidak dapat dihapus. Coba lagi.');
    }
  }

  function openStatus(status) {
    setSelectedStatusId(status.id);
    setComposerOpen(false);
  }

  function moveStatus(direction) {
    const nextStatus = allStatuses[selectedStatusIndex + direction];
    if (nextStatus) openStatus(nextStatus);
  }

  return (
    <main className="status-page">
      <aside className="status-list-panel" aria-label="Daftar Pooddle">
        <header className="status-header">
          <div>
            <p className="status-eyebrow">Momen terbaru</p>
            <h1>Pooddle</h1>
          </div>
          <button
            className="status-icon-button"
            type="button"
            aria-label="Buat Pooddle"
            title="Buat Pooddle"
            onClick={() => setComposerOpen((open) => !open)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
        </header>

        {error && <p className="status-error" role="alert">{error}</p>}

        <div className="status-list-scroll">
          <section className="status-section">
            <h2>Pooddle saya</h2>
            <button
              className="status-row"
              type="button"
              onClick={() => statusGroups.mine[0] ? openStatus(allStatuses[0]) : setComposerOpen(true)}
            >
              <span className={`status-avatar${statusGroups.mine.length ? ' has-status' : ''}`}>
                {currentUser?.avatarUrl ? (
                  <img src={getMediaUrl(currentUser.avatarUrl)} alt="" />
                ) : getInitials(currentUser?.name)}
                <span className="status-add-badge" aria-hidden="true">
                  <span className="material-symbols-outlined">add</span>
                </span>
              </span>
              <span className="status-row-copy">
                <strong>{currentUser?.name || 'Anda'}</strong>
                <span>{statusGroups.mine[0]
                  ? `Diperbarui ${formatStatusTime(statusGroups.mine[0].createdAt)}`
                  : 'Ketuk untuk menambahkan Pooddle'}</span>
              </span>
              {statusGroups.mine.length > 0 && (
                <span className="status-count">{statusGroups.mine.length}</span>
              )}
            </button>
          </section>

          <section className="status-section">
            <h2>Pembaruan terbaru</h2>
            {loading ? (
              <p className="status-empty">Memuat Pooddle...</p>
            ) : statusGroups.contacts.length === 0 ? (
              <p className="status-empty">Belum ada Pooddle baru dari kontak.</p>
            ) : (
              statusGroups.contacts.map(({ user, statuses }) => (
                <button
                  className="status-row"
                  type="button"
                  key={user.id}
                  onClick={() => openStatus(allStatuses.find(({ id }) => id === statuses[0].id))}
                >
                  <span className="status-avatar has-status">
                    {user.avatarUrl ? (
                      <img src={getMediaUrl(user.avatarUrl)} alt="" />
                    ) : getInitials(user.name)}
                  </span>
                  <span className="status-row-copy">
                    <strong>{user.name}</strong>
                    <span>{formatStatusTime(statuses[0].createdAt)}</span>
                  </span>
                  {statuses.length > 1 && <span className="status-count">{statuses.length}</span>}
                </button>
              ))
            )}
          </section>
        </div>
      </aside>

      <section className="status-stage" aria-label="Pratinjau status">
        {composerOpen ? (
          <form className="status-composer" onSubmit={publishStatus}>
            <span className="material-symbols-outlined status-composer-icon" aria-hidden="true">
              edit_note
            </span>
            <h2>Bagikan momen</h2>
            <p>Pooddle akan hilang setelah 24 jam.</p>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Apa yang sedang kamu pikirkan?"
              maxLength={500}
              aria-label="Teks status"
            />
            <div className="status-composer-actions">
              <label className="status-file-button">
                <span className="material-symbols-outlined" aria-hidden="true">image</span>
                {file ? file.name : 'Tambah foto'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <span className="status-character-count">{draft.length}/500</span>
            </div>
            <div className="status-composer-footer">
              <button
                className="status-secondary-button"
                type="button"
                onClick={() => setComposerOpen(false)}
              >
                Batal
              </button>
              <button className="status-primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Membagikan...' : 'Bagikan Pooddle'}
              </button>
            </div>
          </form>
        ) : selectedStatus ? (
          <article className={`status-viewer${selectedStatus.mediaType === 'image' ? ' has-image' : ''}`}>
            {allStatuses.length > 1 && (
              <>
                <button
                  className="status-viewer-arrow status-viewer-arrow-left"
                  type="button"
                  aria-label="Pooddle sebelumnya"
                  title="Pooddle sebelumnya"
                  disabled={selectedStatusIndex <= 0}
                  onClick={() => moveStatus(-1)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                </button>
                <button
                  className="status-viewer-arrow status-viewer-arrow-right"
                  type="button"
                  aria-label="Pooddle berikutnya"
                  title="Pooddle berikutnya"
                  disabled={selectedStatusIndex >= allStatuses.length - 1}
                  onClick={() => moveStatus(1)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </button>
              </>
            )}
            <div className="status-viewer-progress" aria-hidden="true">
              <span />
            </div>
            <header className="status-viewer-header">
              <span className="status-viewer-avatar">
                {selectedStatus.owner?.avatarUrl ? (
                  <img src={getMediaUrl(selectedStatus.owner.avatarUrl)} alt="" />
                ) : getInitials(selectedStatus.owner?.name)}
              </span>
              <span>
                <strong>{selectedStatus.owner?.name || 'Pooddle'}</strong>
                <small>{formatStatusTime(selectedStatus.createdAt)}</small>
              </span>
              <div className="status-viewer-controls">
                {selectedStatus.isMine && (
                  <button type="button" onClick={deleteStatus} aria-label="Hapus Pooddle" title="Hapus Pooddle">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                )}
                <button type="button" onClick={() => setSelectedStatusId(null)} aria-label="Tutup Pooddle" title="Tutup">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </header>
            {selectedStatus.mediaType === 'image' ? (
              mediaSource.statusId === selectedStatus.id && mediaSource.url ? (
                <img className="status-viewer-image" src={mediaSource.url} alt={selectedStatus.content || 'Foto Pooddle'} />
              ) : <p className="status-viewer-loading">Memuat foto Pooddle...</p>
            ) : (
              <p className="status-viewer-text">{selectedStatus.content}</p>
            )}
            {selectedStatus.mediaType === 'image' && selectedStatus.content && (
              <p className="status-viewer-caption">{selectedStatus.content}</p>
            )}
            <nav className="status-viewer-navigation" aria-label="Navigasi Pooddle">
              {allStatuses.map((status) => (
                <button
                  key={status.id}
                  className={status.id === selectedStatus.id ? 'active' : ''}
                  type="button"
                  aria-label={`Buka Pooddle ${status.owner?.name || ''}`}
                  onClick={() => openStatus(status)}
                />
              ))}
            </nav>
          </article>
        ) : (
          <div className="status-stage-empty">
            <span className="status-stage-illustration material-symbols-outlined" aria-hidden="true">
              donut_large
            </span>
            <h2>Bagikan momen harimu</h2>
            <p>Pooddle dari kamu dan kontak akan tampil di sini dan hilang setelah 24 jam.</p>
            <button className="status-primary-button" type="button" onClick={() => setComposerOpen(true)}>
              Buat Pooddle
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default Status;
