
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import usePreferencesStore, { DEFAULT_PREFERENCES } from '../../store/preferencesStore';
import { getMediaUrl } from '../../utils/media';
import './Settings.css';

const SETTINGS_SECTIONS = [
  { id: 'profile', title: 'Profil & Keamanan', icon: 'badge' },
  { id: 'chat', title: 'Obrolan & Tampilan', icon: 'palette' },
  { id: 'notifications', title: 'Notifikasi & Suara', icon: 'notifications_active' },
  { id: 'storage', title: 'Penyimpanan & Data', icon: 'database' },
  { id: 'privacy', title: 'Privasi & Perangkat', icon: 'shield_person' },
  { id: 'help', title: 'Bantuan & Tentang', icon: 'help' },
];

function PreferenceToggle({ label, description, checked, disabled, onChange }) {
  return (
    <label className="settings-toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export default function Settings() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const preferences = usePreferencesStore((state) => state.preferences);
  const isSavingPreference = usePreferencesStore((state) => state.isSaving);
  const updatePreferences = usePreferencesStore((state) => state.updatePreferences);
  const navigate = useNavigate();

  const name = user?.name || '';
  const bio = user?.about || user?.bio || '';
  const avatarUrl = user?.avatarUrl || '';
  const phone = user?.phoneNumber || user?.phone || '';
  const [editing, setEditing] = useState('');
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState('profile');
  const [doodleOpacityDraft, setDoodleOpacityDraft] = useState(null);

  const initial = (name || user?.email || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
  const username = user?.username ? `@${user.username}` : '';
  const handle = username || 'Username belum diatur';

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
      setNotice('Foto profil berhasil diperbarui.');
    } catch (error) {
      setNotice(error.response?.data?.error || 'Foto profil gagal diunggah. Coba lagi.');
    } finally {
      event.target.value = '';
    }
  }

  async function shareContact() {
    const contact = [name, username, phone].filter(Boolean).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: `Kontak ${name}`, text: contact });
        setNotice('Kontak berhasil dibagikan.');
      } else {
        await navigator.clipboard.writeText(contact);
        setNotice('Informasi kontak berhasil disalin.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setNotice('Kontak tidak dapat dibagikan. Periksa izin browser lalu coba lagi.');
      }
    }
  }

  async function savePreference(key, value) {
    try {
      if (key === 'notificationsEnabled' && value && typeof Notification !== 'undefined'
        && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      await updatePreferences({ [key]: value });
      setNotice('Preferensi berhasil disimpan ke akun.');
    } catch (error) {
      setNotice(error.response?.data?.error || 'Preferensi gagal disimpan. Coba lagi.');
    }
  }

  async function resetPreferences() {
    try {
      await updatePreferences(DEFAULT_PREFERENCES);
      setDoodleOpacityDraft(null);
      setNotice('Preferensi dikembalikan ke pengaturan awal.');
    } catch (error) {
      setNotice(error.response?.data?.error || 'Preferensi gagal direset. Coba lagi.');
    }
  }

  return (
    <main className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">PUSAT AKUN &amp; PENGATURAN</span>
          <h1>{SETTINGS_SECTIONS.find((section) => section.id === activeSection)?.title}</h1>
          <p>Preferensi akun disimpan dengan aman dan digunakan di aplikasi ini.</p>
        </div>
        <button
          className="settings-header-version settings-reset-button"
          type="button"
          disabled={isSavingPreference}
          onClick={resetPreferences}
        >
          <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
          Reset preferensi
        </button>
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

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Bagian pengaturan">
          {SETTINGS_SECTIONS.map(({ id, title, icon }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? 'active' : ''}
              aria-current={activeSection === id ? 'page' : undefined}
              onClick={() => setActiveSection(id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
              <span>{title}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content" data-active-section={activeSection}>
          <section className="settings-profile-hero" id="settings-profile" data-section="profile">
            <div className="settings-avatar">
              {avatarUrl ? (
                <img src={getMediaUrl(avatarUrl)} alt="Foto profil" />
              ) : (
                <span>{initial}</span>
              )}
              <label className="settings-avatar-edit" title="Ganti foto profil">
                <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  aria-label="Pilih foto profil"
                />
              </label>
            </div>

            <div className="settings-profile-info">
              <span className="settings-profile-kicker">PROFIL AKUN</span>
              <h2>{name || 'Pengguna'}</h2>
              <p className="settings-profile-handle">{handle}</p>
              <p className="settings-profile-bio">{bio || 'Tambahkan status singkat tentang dirimu.'}</p>
              <span className="settings-profile-badge">
                <span className="settings-status-dot" />
                Akun aktif
              </span>
            </div>

            <div className="settings-profile-actions">
              <button
                className="settings-button-primary"
                type="button"
                onClick={() => openEditor('name', name)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                Edit Profil
              </button>
              <button
                className="settings-button-secondary"
                type="button"
                onClick={shareContact}
              >
                <span className="material-symbols-outlined" aria-hidden="true">share</span>
                Bagikan Kontak
              </button>
            </div>
            <button
              className="settings-status-edit"
              type="button"
              onClick={() => openEditor('bio', bio)}
              aria-label="Edit status profil"
              title="Edit status profil"
            >
              <span className="material-symbols-outlined" aria-hidden="true">edit_note</span>
            </button>
          </section>

          <section className="settings-card" id="settings-account" data-section="profile">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">
                shield_person
              </div>
              <div>
                <h2>Akun &amp; Keamanan</h2>
                <p>Informasi akun dan keamanan yang tersedia.</p>
              </div>
            </div>

            <div className="settings-item">
              <div className="settings-item-icon material-symbols-outlined" aria-hidden="true">call</div>
              <div className="settings-item-content">
                <span className="settings-label">NOMOR TELEPON</span>
                <strong>{phone || 'Belum ditambahkan'}</strong>
                <p>Nomor telepon utama akun kamu.</p>
              </div>
              <span className="settings-readonly">Akun</span>
            </div>

            <div className="settings-item">
              <div className="settings-item-icon material-symbols-outlined" aria-hidden="true">alternate_email</div>
              <div className="settings-item-content">
                <span className="settings-label">USERNAME</span>
                <strong>{handle}</strong>
                <p>Identitas yang dapat dibagikan kepada kontak.</p>
              </div>
              <span className="settings-readonly">Profil</span>
            </div>

            <div className="settings-security-note">
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              <p>Pengaturan verifikasi tambahan belum tersedia. Informasi akun dikelola melalui server.</p>
            </div>
          </section>

          <section className="settings-card settings-preference-card" id="settings-appearance" data-section="chat">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">palette</div>
              <div>
                <h2>Tema &amp; Tampilan</h2>
                <p>Tampilan aplikasi saat ini.</p>
              </div>
            </div>
            <div className="settings-choice-grid" aria-label="Tema aplikasi">
              {[
                { value: 'light', label: 'Terang', icon: 'light_mode' },
                { value: 'dark', label: 'Gelap', icon: 'dark_mode' },
                { value: 'system', label: 'Ikuti sistem', icon: 'settings_suggest' },
              ].map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  className={preferences.theme === theme.value ? 'selected' : ''}
                  disabled={isSavingPreference}
                  aria-pressed={preferences.theme === theme.value}
                  onClick={() => savePreference('theme', theme.value)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">{theme.icon}</span>
                  {theme.label}
                </button>
              ))}
            </div>
            <div className="settings-settings-group">
              <div className="settings-setting-heading">
                <strong>Wallpaper percakapan</strong>
                <small>Pola lembut atau latar polos.</small>
              </div>
              <div className="settings-inline-actions">
                <button
                  type="button"
                  className={preferences.wallpaper === 'doodles' ? 'selected' : ''}
                  disabled={isSavingPreference}
                  onClick={() => savePreference('wallpaper', 'doodles')}
                >
                  Pola hangat
                </button>
                <button
                  type="button"
                  className={preferences.wallpaper === 'plain' ? 'selected' : ''}
                  disabled={isSavingPreference}
                  onClick={() => savePreference('wallpaper', 'plain')}
                >
                  Polos
                </button>
              </div>
              {preferences.wallpaper === 'doodles' && (
                <label className="settings-range-row">
                  <span>Intensitas pola <strong>{preferences.doodleOpacity}%</strong></span>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={doodleOpacityDraft ?? preferences.doodleOpacity}
                    disabled={isSavingPreference}
                    onChange={(event) => setDoodleOpacityDraft(Number(event.target.value))}
                    onPointerUp={(event) => {
                      const value = Number(event.currentTarget.value);
                      setDoodleOpacityDraft(null);
                      savePreference('doodleOpacity', value);
                    }}
                    onKeyUp={(event) => {
                      if (event.key.startsWith('Arrow')) {
                        const value = Number(event.currentTarget.value);
                        setDoodleOpacityDraft(null);
                        savePreference('doodleOpacity', value);
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div className="settings-settings-group">
              <div className="settings-setting-heading">
                <strong>Ukuran teks pesan</strong>
                <small>Perubahan diterapkan di ruang chat.</small>
              </div>
              <div className="settings-inline-actions">
                {[13, 15, 17, 19].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={preferences.fontSize === size ? 'selected' : ''}
                    disabled={isSavingPreference}
                    aria-pressed={preferences.fontSize === size}
                    onClick={() => savePreference('fontSize', size)}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
            <PreferenceToggle
              label="Enter untuk mengirim"
              description="Matikan untuk mencegah Enter mengirim pesan."
              checked={preferences.enterToSend}
              disabled={isSavingPreference}
              onChange={(value) => savePreference('enterToSend', value)}
            />
          </section>

          <section className="settings-card settings-preference-card" id="settings-notifications" data-section="notifications">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">
                notifications_active
              </div>
              <div>
                <h2>Notifikasi</h2>
                <p>Preferensi pemberitahuan akun.</p>
              </div>
            </div>
            <div className="settings-settings-group">
              <PreferenceToggle
                label="Notifikasi pesan"
                description="Tampilkan notifikasi browser saat tab chat tidak aktif."
                checked={preferences.notificationsEnabled}
                disabled={isSavingPreference}
                onChange={(value) => savePreference('notificationsEnabled', value)}
              />
              <PreferenceToggle
                label="Suara notifikasi"
                description="Ikuti pengaturan suara browser untuk pesan baru."
                checked={preferences.notificationSound}
                disabled={isSavingPreference}
                onChange={(value) => savePreference('notificationSound', value)}
              />
              <PreferenceToggle
                label="Pratinjau pesan"
                description="Tampilkan isi pesan pada notifikasi browser."
                checked={preferences.messagePreview}
                disabled={isSavingPreference}
                onChange={(value) => savePreference('messagePreview', value)}
              />
              <PreferenceToggle
                label="Jangan ganggu"
                description="Tahan notifikasi browser tanpa mengubah pesan masuk."
                checked={preferences.doNotDisturb}
                disabled={isSavingPreference}
                onChange={(value) => savePreference('doNotDisturb', value)}
              />
              {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
                <p className="settings-feature-note">Izin notifikasi ditolak oleh browser. Ubah izin situs dari pengaturan browser.</p>
              )}
            </div>
          </section>

          <section className="settings-card settings-preference-card" id="settings-privacy" data-section="privacy">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">
                visibility
              </div>
              <div>
                <h2>Privasi &amp; Status Online</h2>
                <p>Kontrol privasi akun.</p>
              </div>
            </div>
            <div className="settings-settings-group">
              <PreferenceToggle
                label="Tampilkan status online"
                description="Kontak tidak melihat status online akunmu saat dimatikan."
                checked={preferences.showOnlineStatus}
                disabled={isSavingPreference}
                onChange={(value) => savePreference('showOnlineStatus', value)}
              />
              <PreferenceToggle
                label="Kirim tanda baca"
                description="Kontak tidak menerima konfirmasi saat pesan mereka dibaca."
                checked={preferences.showReadReceipts}
                disabled={isSavingPreference}
                onChange={(value) => savePreference('showReadReceipts', value)}
              />
            </div>
          </section>

          <section className="settings-card settings-storage-card" data-section="storage">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">database</div>
              <div>
                <h2>Penyimpanan &amp; Data</h2>
                <p>Informasi penyimpanan yang tersedia untuk akun ini.</p>
              </div>
            </div>
            <div className="settings-storage-summary">
              <span className="material-symbols-outlined" aria-hidden="true">cloud_done</span>
              <div>
                <strong>Lampiran percakapan</strong>
                <p>File yang dikirim tersimpan di server dan hanya dapat diakses melalui percakapan terkait.</p>
              </div>
            </div>
            <p className="settings-feature-note">Pengelolaan cache lokal, batas kuota, unduh otomatis, dan pencadangan belum tersedia di server.</p>
          </section>

          <section className="settings-card settings-devices-card" id="settings-devices" data-section="privacy">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">devices</div>
              <div>
                <h2>Perangkat Tertaut</h2>
                <p>Sesi akun di perangkat ini.</p>
              </div>
              <span className="settings-readonly">Sesi ini</span>
            </div>
            <div className="settings-device-row">
              <span className="settings-device-icon material-symbols-outlined" aria-hidden="true">laptop</span>
              <div>
                <strong>Perangkat ini</strong>
                <p>Sesi akun yang sedang digunakan</p>
              </div>
              <span className="settings-device-status">
                <span className="settings-status-dot" />
                Aktif
              </span>
            </div>
            <div className="settings-device-footer">
              <p>Keluar akan mengakhiri sesi akun ini.</p>
              <button
                className="settings-logout-button"
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">logout</span>
                Keluar dari akun
              </button>
            </div>
          </section>

          <section className="settings-card settings-help-card" data-section="help">
            <div className="settings-card-heading">
              <div className="settings-heading-icon material-symbols-outlined" aria-hidden="true">help</div>
              <div>
                <h2>Bantuan &amp; Tentang</h2>
                <p>Informasi penggunaan dan versi aplikasi.</p>
              </div>
            </div>
            <div className="settings-faq-list">
              <details>
                <summary>Bagaimana cara memulai percakapan?</summary>
                <p>Buka Kontak, pilih orang yang ingin dihubungi, lalu mulai percakapan.</p>
              </details>
              <details>
                <summary>Bagaimana mengirim foto atau dokumen?</summary>
                <p>Gunakan tombol lampiran di ruang chat. Jenis dan ukuran file diperiksa oleh server.</p>
              </details>
              <details>
                <summary>Di mana foto profil dan pesan disimpan?</summary>
                <p>Data akun dan lampiran disimpan melalui backend aplikasi. Jangan kirim informasi rahasia melalui chat.</p>
              </details>
            </div>
            <div className="settings-about-row">
              <span>QuacksApp</span>
              <span>Versi {import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
            </div>
          </section>

          <footer className="settings-footer">
            Pengaturan akun QuacksApp
          </footer>
        </div>
      </div>

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
