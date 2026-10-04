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
  const [query, setQuery] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      .catch(() => {
        if (active) setError('Kontak belum dapat dimuat. Periksa koneksi lalu coba lagi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id');
    if (!normalizedQuery) return contacts;
    return contacts.filter(({ contactUser }) =>
      `${contactUser.name} ${contactUser.phoneNumber}`.toLocaleLowerCase('id').includes(normalizedQuery)
    );
  }, [contacts, query]);

  async function addContact(event) {
    event.preventDefault();
    const normalizedNumber = phoneNumber.trim();
    if (!normalizedNumber) return;

    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const response = await api.post('/contacts', { phoneNumber: normalizedNumber });
      setContacts((current) => [response.data, ...current]);
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
    setError('');
    try {
      const response = await api.post('/conversations', { contactUserId });
      navigate(`/chats/${response.data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Chat belum dapat dibuka. Coba lagi.');
    }
  }

  return (
    <main className="contacts-page">
      <section className="contacts-panel" aria-label="Daftar kontak">
        <header className="contacts-header">
          <button className="contacts-back" aria-label="Kembali ke chat" onClick={() => navigate('/')}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <p className="contacts-kicker">RUANG PESAN</p>
            <h1>Kontak</h1>
          </div>
          <button
            className="contacts-add-toggle"
            aria-label={formOpen ? 'Tutup form tambah kontak' : 'Tambah kontak'}
            title={formOpen ? 'Tutup' : 'Tambah kontak'}
            onClick={() => { setFormOpen((open) => !open); setError(''); setNotice(''); }}
          >
            <span className="material-symbols-outlined">{formOpen ? 'close' : 'person_add'}</span>
          </button>
        </header>

        <div className="contacts-content">
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

          <label className="contacts-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama atau nomor"
              aria-label="Cari kontak"
            />
            {query && (
              <button type="button" aria-label="Hapus pencarian" onClick={() => setQuery('')}>
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </label>

          <div className="contacts-list-heading">
            <h2>Semua kontak</h2>
            <span>{contacts.length}</span>
          </div>

          {loading ? (
            <p className="contacts-empty">Memuat kontak...</p>
          ) : filteredContacts.length === 0 ? (
            <div className="contacts-empty-state">
              <span className="material-symbols-outlined">{query ? 'search_off' : 'people'}</span>
              <p>{query ? 'Kontak tidak ditemukan.' : 'Belum ada kontak.'}</p>
              {!query && <button onClick={() => setFormOpen(true)}>Tambah kontak pertama</button>}
            </div>
          ) : (
            <ul className="contacts-list">
              {filteredContacts.map(({ id, contactUser }) => {
                const isOnline = onlineUsers.has(contactUser.id);
                return (
                  <li key={id}>
                    <button className="contact-row" onClick={() => openChat(contactUser.id)}>
                      <span className="contact-avatar">
                        {contactUser.avatarUrl ? (
                          <img src={contactUser.avatarUrl} alt="" />
                        ) : (
                          <span>{initials(contactUser.name)}</span>
                        )}
                        <i className={isOnline ? 'is-online' : ''} />
                      </span>
                      <span className="contact-details">
                        <strong>{contactUser.name}</strong>
                        <small>{isOnline ? 'Online' : contactUser.phoneNumber}</small>
                      </span>
                      <span className="material-symbols-outlined contact-open-icon">chat</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

export default Contacts;