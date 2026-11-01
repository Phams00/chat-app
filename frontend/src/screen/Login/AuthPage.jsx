import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { connectSocket } from "../../services/socket";
import useAuthStore from "../../store/authStore";
import "./AuthPage.css";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const credentials = { phoneNumber: phoneNumber.trim(), password };
      if (isRegister) {
        await api.post("/auth/register", { ...credentials, name: name.trim() });
      }

      const response = await api.post("/auth/login", credentials);
      const { token, user } = response.data || {};
      if (!token || !user?.id) {
        throw new Error("Server mengirim data login yang tidak lengkap. Coba lagi.");
      }

      setAuth(token, user);
      connectSocket(token);
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          (requestError.request
            ? "Tidak dapat terhubung ke server. Pastikan backend berjalan, lalu coba lagi."
            : requestError.message || "Terjadi kesalahan. Coba lagi."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="qa-login">
      {/* Header */}
      <header className="qa-header">
        <div className="qa-header__inner">
          {/* Brand Logo & Identity */}
          <div className="qa-brand">
            <div className="qa-brand__logo">
              <img
                alt="Logo QuacksApp"
                src="/quacks-logo.png"
              />
            </div>
            <div className="qa-brand__text">
              <div className="qa-brand__name-row">
                <span className="qa-brand__name">QuacksApp</span>
              </div>
              <span className="qa-brand__tagline">Pesan dan berbagi kabar</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: 2-Column Desktop Authentication */}
      <main className="qa-main">
        <div className="qa-main__grid">
          {/* Left Column: Sleek Form Glass Card */}
          <div className="qa-form-col">
            <div className="qa-form-card">
              {/* Header within Form */}
              <div className="qa-form-header">
                <div className="qa-form-header__mascot">
                  <img
                    alt="Maskot QuacksApp"
                    src="/quacks-mascot.png"
                  />
                </div>
                <div>
                  <h1 className="qa-form-header__title">
                    {isRegister ? "Buat Akun QuacksApp" : "Selamat Datang Kembali!"}
                  </h1>
                  <p className="qa-form-header__subtitle">
                    {isRegister
                      ? "Daftar untuk mulai mengobrol dengan aman dan privat."
                      : "Masuk untuk mulai mengobrol dengan aman dan privat."}
                  </p>
                </div>
              </div>

              {/* Phone Panel */}
              <form className="qa-panel" id="panel-phone" onSubmit={handleSubmit}>
                <div className="qa-field">
                  <label className="qa-field__label" htmlFor="phone-number">Nomor Telepon</label>
                  <div className="qa-input-group qa-input-group--phone">
                    <div className="qa-input-group__prefix">
                      <span className="qa-input-group__flag">🇮🇩</span>
                      <span className="qa-input-group__code">+62</span>
                      <span className="material-symbols-outlined qa-icon qa-icon--sm qa-icon--muted">arrow_drop_down</span>
                    </div>
                    <input
                      className="qa-input qa-input--phone"
                      id="phone-number"
                      placeholder="812 3456 7890"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={phoneNumber}
                      onChange={(event) => {
                        setPhoneNumber(event.target.value);
                        setError("");
                      }}
                      required
                    />
                  </div>
                </div>
                {isRegister && (
                  <div className="qa-field">
                    <label className="qa-field__label" htmlFor="account-name">Nama Lengkap</label>
                    <div className="qa-input-group qa-input-group--icon">
                      <input
                        className="qa-input"
                        id="account-name"
                        placeholder="Masukkan nama lengkap"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(event) => {
                          setName(event.target.value);
                          setError("");
                        }}
                        required
                      />
                    </div>
                  </div>
                )}
                <div className="qa-field">
                  <label className="qa-field__label" htmlFor="password-field">Kata Sandi</label>
                  <div className="qa-input-group qa-input-group--icon">
                    <span className="material-symbols-outlined qa-icon qa-icon--lg qa-input-group__icon">lock</span>
                    <input
                      className="qa-input"
                      id="password-field"
                      placeholder={isRegister ? "Buat kata sandi minimal 6 karakter" : "Masukkan kata sandi akun Anda"}
                      type={showPassword ? "text" : "password"}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      minLength={isRegister ? 6 : undefined}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError("");
                      }}
                      required
                    />
                    <button
                      className="qa-input-group__toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      type="button"
                    >
                      <span className="material-symbols-outlined qa-icon qa-icon--lg" id="password-icon">
                        {showPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>
                <div className="qa-options">
                  <label className="qa-options__remember">
                    <input className="qa-checkbox" defaultChecked type="checkbox" />
                    <span className="qa-options__remember-text">Ingat saya di perangkat ini</span>
                  </label>
                </div>
                {error && <p className="qa-auth-error" role="alert">{error}</p>}
                <button className="qa-submit" type="submit" disabled={loading}>
                  <span>{loading ? "Memproses..." : isRegister ? "Daftar Sekarang" : "Masuk Sekarang"}</span>
                  <span className="material-symbols-outlined qa-icon qa-icon--lg qa-submit__arrow">arrow_forward</span>
                </button>
              </form>

              {/* Register Link */}
              <div className="qa-register">
                {isRegister ? "Sudah punya akun QuacksApp?" : "Belum punya akun QuacksApp?"}{" "}
                <button
                  className="qa-register__link"
                  type="button"
                  onClick={() => {
                    setIsRegister((value) => !value);
                    setError("");
                  }}
                >
                  {isRegister ? "Masuk di sini" : "Daftar di sini"}
                </button>
              </div>
            </div>
          </div>

          {/* Informasi fitur */}
          <div className="qa-showcase-col">
            <div className="qa-showcase">
              <div className="qa-showcase__content">
                <img
                  className="qa-showcase__mascot"
                  src="/quacks-logo-hd.jpeg"
                  alt="Maskot bebek QuacksApp"
                />
                <h2 className="qa-showcase__title">Semua percakapan di satu tempat</h2>
                <p className="qa-showcase__text">
                  Kirim pesan, foto, video, dan file. Bagikan Pooddle dan tetap terhubung dengan kontak.
                </p>
              </div>
            </div>

            <div className="qa-badges">
              <div className="qa-badge">
                <div className="qa-badge__icon">
                  <span className="material-symbols-outlined qa-icon qa-icon--19">chat</span>
                </div>
                <div>
                  <h4 className="qa-badge__title">Percakapan langsung</h4>
                  <p className="qa-badge__text">Lihat pesan baru tanpa perlu memuat ulang halaman.</p>
                </div>
              </div>
              <div className="qa-badge">
                <div className="qa-badge__icon">
                  <span className="material-symbols-outlined qa-icon qa-icon--19">perm_media</span>
                </div>
                <div>
                  <h4 className="qa-badge__title">Berbagi media</h4>
                  <p className="qa-badge__text">Kirim foto, video, dan dokumen dari ruang chat.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="qa-footer">
        <div className="qa-footer__inner">
          <p className="qa-footer__copyright">© 2026 QuacksApp</p>
        </div>
      </footer>
    </div>
  );
}
