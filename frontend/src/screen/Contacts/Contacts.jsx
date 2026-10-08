import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePresenceStore from '../../store/presenceStore';
import { connectSocket } from '../../services/socket';
import './Contacts.css';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [query, setQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const token = useAuthStore((state) => state.token);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const navigate = useNavigate();

  useEffect(() => {
    connectSocket(token);
    let active = true;

    api.get('/contacts')
      .then((response) => {
        if (active) setContacts(response.data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error ||
              'Kontak belum dapat dimuat. Periksa koneksi lalu coba lagi.',
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

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id');
    const result = contacts.filter(({ contactUser }) =>
      `${contactUser.name} ${contactUser.phoneNumber}`
        .toLocaleLowerCase('id')
        .includes(normalizedQuery),
    );

    return result.sort((first, second) =>
      first.contactUser.name.localeCompare(second.contactUser.name, 'id'),
    );
  }, [contacts, query]);

  const contactsBySection = useMemo(() => {
    const sections = new Map();

    for (const contact of filteredContacts) {
      const section = contact.contactUser.name.trim().charAt(0).toLocaleUpperCase('id') || '#';
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section).push(contact);
    }

    return [...sections.entries()];
  }, [filteredContacts]);

  const selectedContact = contacts.find(
    ({ contactUser }) => contactUser.id === selectedContactId,
  );

  async function addContact(event) {
    event.preventDefault();
    const normalizedNumber = phoneNumber.trim();
    if (!normalizedNumber || submitting) return;

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post('/contacts', { phoneNumber: normalizedNumber });
      setContacts((current) => [response.data, ...current]);
      setSelectedContactId(response.data.contactUser.id);
      setPhoneNumber('');
      setFormOpen(false);
      setNotice(`${response.data.contactUser.name} ditambahkan ke kontak.`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Kontak tidak dapat ditambahkan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openChat(contactUserId) {
    if (openingChat) return;
    setOpeningChat(true);
    setError('');
    try {
      const response = await api.post('/conversations', { contactUserId });
      navigate(`/chats/${response.data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Chat belum dapat dibuka. Coba lagi.');
    } finally {
      setOpeningChat(false);
    }
  }

  return (
    <main className={`contacts-page${selectedContact ? ' has-selection' : ''}`}>
      <aside className="contacts-sidebar" aria-label="Daftar kontak">
        <header className="contacts-header">
          <div className="contacts-header-top">
            <div className="contacts-title-wrapper">
              <button
                className="contacts-icon-button"
                type="button"
                title="Kembali ke chat"
                aria-label="Kembali ke chat"
                onClick={() => navigate('/')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              </button>
              <h1>Chat baru</h1>
            </div>
            <button
              className="contacts-icon-button"
              type="button"
              title="Dialpad belum tersedia"
              aria-label="Dialpad belum tersedia"
              disabled
            >
              <span className="material-symbols-outlined" aria-hidden="true">dialpad</span>
            </button>
          </div>

          <label className="contacts-search">
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input
              type="search"
              placeholder="Cari nama, nomor atau @username"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Cari kontak"
            />
            {query ? (
              <button
                type="button"
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
                onClick={() => setQuery('')}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            ) : (
              <button type="button" title="Filter belum tersedia" aria-label="Filter belum tersedia" disabled>
                <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
              </button>
            )}
          </label>
        </header>

        <div className="contacts-actions">
          <button
            className="contact-action"
            type="button"
            disabled
            title="Grup belum tersedia"
          >
            <span className="contact-action-icon">
              <span className="material-symbols-outlined" aria-hidden="true">group_add</span>
            </span>
            <span>Grup baru</span>
          </button>
          <button
            className={`contact-action${formOpen ? ' active' : ''}`}
            type="button"
            aria-expanded={formOpen}
            onClick={() => {
              setFormOpen((open) => !open);
              setError('');
              setNotice('');
            }}
          >
            <span className="contact-action-icon">
              <span className="material-symbols-outlined" aria-hidden="true">
                {formOpen ? 'close' : 'person_add'}
              </span>
            </span>
            <span>Kontak baru</span>
          </button>
          <button
            className="contact-action"
            type="button"
            disabled
            title="Komunitas belum tersedia"
          >
            <span className="contact-action-icon">
              <span className="material-symbols-outlined" aria-hidden="true">groups</span>
            </span>
            <span>Komunitas baru</span>
          </button>
        </div>

        <div className="contacts-list">
          {formOpen && (
            <form className="contacts-add-form" onSubmit={addContact}>
              <label htmlFor="contact-phone">Nomor telepon</label>
              <div className="contacts-add-fields">
                <input
                  id="contact-phone"
                  autoFocus
                  type="tel"
                  autoComplete="tel"
                  placeholder="Contoh: 081234567890"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
                <button type="submit" disabled={submitting || !phoneNumber.trim()}>
                  {submitting ? 'Menambahkan...' : 'Tambah'}
                </button>
              </div>
              <p>Kontak harus sudah terdaftar di Chat App.</p>
            </form>
          )}

          {error && <p className="contacts-message contacts-error" role="alert">{error}</p>}
          {notice && <p className="contacts-message contacts-success" role="status">{notice}</p>}

          {loading ? (
            <p className="contacts-empty">Memuat kontak...</p>
          ) : filteredContacts.length === 0 ? (
            <div className="contacts-empty">
              <span className="material-symbols-outlined" aria-hidden="true">
                {query ? 'person_search' : 'people'}
              </span>
              <p>{query ? 'Kontak tidak ditemukan' : 'Belum ada kontak'}</p>
              {!query && !formOpen && (
                <button
                  className="contacts-empty-add"
                  type="button"
                  onClick={() => setFormOpen(true)}
                >
                  Tambah kontak
                </button>
              )}
            </div>
          ) : (
            contactsBySection.map(([section, sectionContacts]) => (
              <section className="contact-section" key={section} aria-label={`Kontak ${section}`}>
                <h2 className="contact-section-title">{section}</h2>
                {sectionContacts.map(({ id, contactUser }) => {
                  const isOnline = onlineUsers.has(contactUser.id);
                  const isSelected = contactUser.id === selectedContactId;

                  return (
                    <button
                      className={`contact-item${isSelected ? ' selected' : ''}`}
                      key={id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedContactId(contactUser.id)}
                    >
                      <span className="contact-avatar">
                        {contactUser.avatarUrl ? (
                          <img src={contactUser.avatarUrl} alt="" />
                        ) : (
                          <span>{initials(contactUser.name)}</span>
                        )}
                        <i className={isOnline ? 'is-online' : ''} />
                      </span>
                      <span className="contact-name">{contactUser.name}</span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </aside>

      <section className="contact-detail" aria-label="Detail kontak">
        {selectedContact ? (
          <div className="contact-profile">
            <button
              className="contact-detail-back"
              type="button"
              aria-label="Kembali ke daftar kontak"
              onClick={() => setSelectedContactId(null)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            </button>
            <div className="contact-profile-avatar">
              {selectedContact.contactUser.avatarUrl ? (
                <img
                  src={selectedContact.contactUser.avatarUrl}
                  alt={selectedContact.contactUser.name}
                />
              ) : (
                <span>{initials(selectedContact.contactUser.name)}</span>
              )}
            </div>
            <h2>{selectedContact.contactUser.name}</h2>
            <p>{selectedContact.contactUser.phoneNumber}</p>
            <div className="profile-actions">
              <button
                type="button"
                disabled={openingChat}
                onClick={() => openChat(selectedContact.contactUser.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">chat</span>
                <span>{openingChat ? 'Membuka...' : 'Pesan'}</span>
              </button>
              <button
                type="button"
                disabled
                title="Panggilan belum tersedia"
              >
                <span className="material-symbols-outlined" aria-hidden="true">call</span>
                <span>Telepon</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="contact-detail-empty">
            <div className="contact-detail-actions">
              <span className="contact-detail-mark">
                <span className="material-symbols-outlined" aria-hidden="true">forum</span>
              </span>
              <h2>Pilih kontak untuk memulai chat</h2>
              <p>Kontak yang kamu pilih akan muncul di sini.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default Contacts;
