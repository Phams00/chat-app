
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { getMediaUrl } from '../../utils/media';
import './Settings.css';

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setBio(user?.about || user?.bio || '');
    setAvatarUrl(user?.avatarUrl || '');
    setPhone(user?.phoneNumber || user?.phone || '');
  }, [user]);

  const initial = (name || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  function openEditor(field, value) {
    setEditing(field);
    setDraft(value || '');
    setNotice('');
  }

  function closeEditor() {
    setEditing('');
    setDraft('');
  }

  async function handleSave() {
    if (editing === 'name' && !draft.trim()) {
      setNotice('Kolom tidak boleh kosong.');
      return;
    }

    try {
      const payload = editing === 'name'
        ? { name: draft.trim() }
        : { about: draft.trim() };
      const { data: profile } = await api.patch('/profile/me', payload);
      setAuth(token, { ...user, ...profile, bio: profile.about || '' });
      setName(profile.name || '');
      setBio(profile.about || '');
      setNotice('Profil berhasil diperbarui.');
      closeEditor();
    } catch (error) {
      setNotice(error.response?.data?.error || 'Profil gagal diperbarui. Coba lagi.');
    }
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotice('Pilih file gambar yang valid.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setNotice('Ukuran foto maksimal 2 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const { data: profile } = await api.post('/profile/me/avatar', formData);
      setAuth(token, { ...user, ...profile, bio: profile.about || '' });
      setAvatarUrl(profile.avatarUrl || '');
      setNotice('Foto profil berhasil diperbarui.');
    } catch (error) {
      setNotice(error.response?.data?.error || 'Foto profil gagal diunggah. Coba lagi.');
    } finally {
      event.target.value = '';
    }
  }

  async function copyProfileLink() {
    const username = user?.username || user?.id;

    if (!username) {
      setNotice('Tautan profil belum tersedia untuk akun ini.');
      return;
    }

    const link = `${window.location.origin}/profile/${username}`;

    try {
      await navigator.clipboard.writeText(link);
      setNotice('Tautan profil berhasil disalin.');
    } catch {
      setNotice('Gagal menyalin tautan. Periksa izin clipboard browser.');
    }
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">PENGATURAN AKUN</span>
          <h1>Profil &amp; Akun</h1>
          <p>Kelola informasi dan identitas akun kamu.</p>
        </div>

          <span className="settings-header-icon material-symbols-outlined" aria-hidden="true">settings</span>
      </header>

      {notice && (
        <div className="settings-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            aria-label="Tutup notifikasi"
          >
            ×
          </button>
        </div>
      )}

      <section className="settings-profile-hero">
        <div className="settings-avatar">
          {avatarUrl ? (
            <img src={getMediaUrl(avatarUrl)} alt="Foto profil" />
          ) : (
            <span>{initial}</span>
          )}
          <label className="settings-avatar-edit" title="Ganti foto profil">
            <span>✎</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              aria-label="Pilih foto profil"
            />
          </label>
        </div>

        <div className="settings-profile-info">
          <h2>{name || 'Pengguna'}</h2>
          <p>{user?.email || 'Akun QuacksApp'}</p>
          <span className="settings-profile-badge">
            <span className="settings-status-dot" />
            Akun aktif
          </span>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-heading-icon">♙</div>
          <div>
            <h2>Informasi profil</h2>
            <p>Informasi dasar yang ditampilkan di akun kamu.</p>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon">Aa</div>
          <div className="settings-item-content">
            <span className="settings-label">NAMA TAMPILAN</span>
            <strong>{name || 'Belum diatur'}</strong>
            <p>Nama yang dapat dilihat oleh pengguna lain.</p>
          </div>
          <button
            className="settings-edit-button"
            type="button"
            onClick={() => openEditor('name', name)}
            aria-label="Edit nama tampilan"
          >
            ✎
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon">☰</div>
          <div className="settings-item-content">
            <span className="settings-label">INFO / BIO</span>
            <strong>{bio || 'Tambahkan bio kamu'}</strong>
            <p>Ceritakan sedikit tentang diri kamu.</p>
          </div>
          <button
            className="settings-edit-button"
            type="button"
            onClick={() => openEditor('bio', bio)}
            aria-label="Edit bio"
          >
            ✎
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon">↗</div>
          <div className="settings-item-content">
            <span className="settings-label">TAUTAN PROFIL</span>
            <strong>Bagikan profil kamu</strong>
            <p>Salin tautan profil jika tersedia.</p>
          </div>
          <button
            className="settings-edit-button"
            type="button"
            onClick={copyProfileLink}
            aria-label="Salin tautan profil"
          >
            ▢
          </button>
        </div>
      </section>

      <section className="settings-card settings-account-actions">
        <div className="settings-item">
          <div className="settings-item-icon material-symbols-outlined" aria-hidden="true">logout</div>
          <div className="settings-item-content">
            <span className="settings-label">SESI AKUN</span>
            <strong>Keluar dari akun</strong>
            <p>Akhiri sesi QuacksApp di perangkat ini.</p>
          </div>
          <button
            className="settings-logout-button"
            type="button"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Keluar
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-heading-icon">♧</div>
          <div>
            <h2>Informasi akun</h2>
            <p>Informasi kontak dan keamanan akun.</p>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-icon">☎</div>
          <div className="settings-item-content">
            <span className="settings-label">NOMOR TELEPON</span>
            <strong>{phone || 'Belum ditambahkan'}</strong>
            <p>Nomor telepon yang terhubung ke akun.</p>
          </div>
          <span className="settings-readonly">Akun</span>
        </div>

        <div className="settings-security-note">
          <span>♧</span>
          <p>
            Untuk keamanan akun, perubahan informasi sensitif perlu
            divalidasi oleh server.
          </p>
        </div>
      </section>

      <footer className="settings-footer">
        QuacksApp · Pengaturan akun
      </footer>

      {editing && (
        <div
          className="settings-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className="settings-modal-top">
              <div>
                <span className="settings-eyebrow">EDIT PROFIL</span>
                <h2 id="settings-modal-title">
                  {editing === 'name' ? 'Nama tampilan' : 'Info / Bio'}
                </h2>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={closeEditor}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <label htmlFor="settings-draft">
              {editing === 'name' ? 'Nama' : 'Bio'}
            </label>

            {editing === 'bio' ? (
              <textarea
                id="settings-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={139}
                rows={4}
                autoFocus
              />
            ) : (
              <input
                id="settings-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={50}
                autoFocus
              />
            )}

            <div className="settings-char-count">
              {draft.length}/{editing === 'name' ? 50 : 139}
            </div>

            <div className="settings-modal-actions">
              <button
                type="button"
                className="settings-button-secondary"
                onClick={closeEditor}
              >
                Batal
              </button>
              <button
                type="button"
                className="settings-button-primary"
                onClick={handleSave}
                disabled={editing === 'name' && !draft.trim()}
              >
                Simpan
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
