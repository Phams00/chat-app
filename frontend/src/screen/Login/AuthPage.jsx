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
                alt="QuacksApp Mascot"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRTGh9nNvljfRRjFXnedqSDX0yY7q4iV0oDnPfanuxY21APBRqytKSuoOmpTqHzjErbR-9YA3OvXAR7tg0-ExPVNbnA3L8xq72awKtFmrCEt4n3o4oXL7eHKSYyCrb5qxRTDOnRBYMU4xtth02gA1Ii0CQJql3i23PuM8DAUzbQGZh-z_9lP-5HG2xC0TdclO40d2GDkE_pe9y3dXaScOnwV5ABhQ7kvoeTvyOAI8V6bLaHEyfuZHw1-2fv0oLNAhehpM"
              />
            </div>
            <div className="qa-brand__text">
              <div className="qa-brand__name-row">
                <span className="qa-brand__name">QuacksApp</span>
                <span className="qa-brand__dot"></span>
              </div>
              <span className="qa-brand__tagline">Private &amp; Decentralized Messenger</span>
            </div>
          </div>
          {/* Live Status & Global Controls */}
          <div className="qa-header__controls">
            <div className="qa-header__links">
              <button className="qa-header__link">
                <span className="material-symbols-outlined qa-icon qa-icon--17 qa-icon--accent">language</span>
                <span className="qa-header__link-label">ID / Indonesia</span>
              </button>
              <span className="qa-header__separator">|</span>
              <button className="qa-header__link">
                <span className="material-symbols-outlined qa-icon qa-icon--17 qa-icon--muted">help_outline</span>
                <span className="qa-header__link-label">Bantuan</span>
              </button>
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
                    alt="Quacks Mascot"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCylNJY1l5KoLpQeCP03rba_5Et5l1sRpfN-OOn_JvW7sfgrcsaItgq-nkCRiK4fifyzbIPtIX8lqfoO8mPYv0LN3pSSkLIzK-IrtM-gQvRmfWJafyOuDLqqrwoflrv5iW-BFIApqmmUVRCGRJSaV3i_qaO1RtzZaSg40dqC6TQZyp0uGa50ycMsC_DD_6AYu-kiT-D1DX5rkNiCAvHm5x0WD_fqpjay_JF1P6-o_QEfqdcrfGyFI0btn1Kkht2HKogpQ"
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

              {/* Segmented Tab Switch */}
              <div className="qa-tabs">
                <button
                  className="qa-tab qa-tab--active"
                  id="tab-phone"
                  type="button"
                >
                  <span className="material-symbols-outlined qa-icon qa-icon--18 qa-icon--accent">smartphone</span>
                  Nomor Ponsel
                </button>
                <button
                  className="qa-tab qa-tab--inactive"
                  id="tab-email"
                  type="button"
                  disabled
                  title="Login email atau Quacks ID belum tersedia"
                >
                  <span className="material-symbols-outlined qa-icon qa-icon--18">alternate_email</span>
                  Email / Quacks ID
                </button>
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
                  <button
                    className="qa-options__forgot"
                    type="button"
                    disabled
                    title="Pemulihan kata sandi belum tersedia"
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>
                {error && <p className="qa-auth-error" role="alert">{error}</p>}
                <button className="qa-submit" type="submit" disabled={loading}>
                  <span>{loading ? "Memproses..." : isRegister ? "Daftar Sekarang" : "Masuk Sekarang"}</span>
                  <span className="material-symbols-outlined qa-icon qa-icon--lg qa-submit__arrow">arrow_forward</span>
                </button>
              </form>

              {/* Divider */}
              <div className="qa-divider">
                <div className="qa-divider__line"></div>
                <span className="qa-divider__text">ATAU</span>
                <div className="qa-divider__line"></div>
              </div>

              {/* Google Auth */}
              <button
                className="qa-google"
                type="button"
                disabled
                title="Login dengan Google belum tersedia"
              >
                <svg className="qa-google__icon" viewBox="0 0 24 24">
                  <path d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" fill="#EA4335"></path>
                  <path d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" fill="#4285F4"></path>
                  <path d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" fill="#FBBC05"></path>
                  <path d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" fill="#34A853"></path>
                </svg>
                <span>Lanjutkan dengan Google</span>
              </button>

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

          {/* Right Column: Gentle Falling Duck Rain Ambient Showcase */}
          <div className="qa-showcase-col">
            <div className="qa-showcase">
              {/* Falling Ducks Rain Effect (Continuous smooth stream without pauses) */}
              <div aria-hidden="true" className="qa-ducks">
                {/* Duck 1: Left soft drift */}
                <div className="qa-duck qa-duck-rain-1 qa-duck--1" style={{ animationDelay: "0s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
                {/* Duck 2: Mid-left delicate float */}
                <div className="qa-duck qa-duck-rain-2 qa-duck--2" style={{ animationDelay: "2.1s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
                {/* Duck 3: Center gently spinning */}
                <div className="qa-duck qa-duck-rain-3 qa-duck--3" style={{ animationDelay: "4.2s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
                {/* Duck 4: Mid-right smooth glide */}
                <div className="qa-duck qa-duck-rain-4 qa-duck--4" style={{ animationDelay: "1.1s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
                {/* Duck 5: Far-right sway */}
                <div className="qa-duck qa-duck-rain-5 qa-duck--5" style={{ animationDelay: "3.3s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
                {/* Duck 6: Additional subtle stream */}
                <div className="qa-duck qa-duck-rain-6 qa-duck--6" style={{ animationDelay: "5.4s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
                {/* Duck 7: Secondary right streamer */}
                <div className="qa-duck qa-duck-rain-7 qa-duck--7" style={{ animationDelay: "6.6s" }}>
                  <img
                    alt=""
                    src="/quacks-logo-hd.jpeg"
                  />
                </div>
              </div>

              {/* Center Showcase Content */}
              <div className="qa-showcase__content">
                {/* Central Hero Mascot Frame */}
                <div className="qa-hero">
                  <div className="qa-hero__frame">
                    <img
                      alt="Quacks Mascot Hero"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0jENEBPlpb704_VjP6bhzwyCWa4gi7hlkdXEFpfyCJ6b_CNby2dxmuPuU2sfQo2HPXOwOyH7-1N6H5R86LmK18ammEgIlMGXAolqmoaBEKzmxiDVqknFR3H6yrmkqmkCP3cyYptGWjPreJ6k5Q7UjGiYwMtwHwC45lZPGUIJb44TAf0EaPf5xcvhUqsFuvytOscKS49RFQSDkOjQUTZS_fC79zQL4vMX6u9qEMj_hDVDhFI72M8WENu06KgOKcUTqwqE"
                    />
                    <div className="qa-hero__badge">
                      <span className="material-symbols-outlined qa-icon qa-icon--base">chat_bubble</span>
                    </div>
                  </div>
                </div>
                <h2 className="qa-showcase__title">Obrolan Cepat, Bebas &amp; Terenkripsi</h2>
                <p className="qa-showcase__text">
                  Nikmati pengalaman berkirim pesan tanpa pelacakan data dengan kecepatan protokol terdesentralisasi QuacksApp.
                </p>
              </div>
            </div>

            {/* Security Badges: End-to-End Encrypted & Peer-to-Peer Mesh Node */}
            <div className="qa-badges">
              <div className="qa-badge glass-card">
                <div className="qa-badge__icon">
                  <span className="material-symbols-outlined qa-icon qa-icon--19">lock</span>
                </div>
                <div>
                  <h4 className="qa-badge__title">End-to-End Encrypted</h4>
                  <p className="qa-badge__text">Pesan dan media terlindungi kriptografi desentralisasi penuh.</p>
                </div>
              </div>
              <div className="qa-badge glass-card">
                <div className="qa-badge__icon">
                  <span className="material-symbols-outlined qa-icon qa-icon--19">hub</span>
                </div>
                <div>
                  <h4 className="qa-badge__title">Peer-to-Peer Mesh v2.4</h4>
                  <p className="qa-badge__text">Terhubung seketika antar-perangkat tanpa server perantara.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Minimalist Cyber-Security Footer */}
      <footer className="qa-footer">
        <div className="qa-footer__inner">
          <div className="qa-footer__status">
            <span className="qa-footer__dot"></span>
            <span className="qa-footer__status-text">QUACKSAPP Decentralized Protocol • Zero Knowledge Architecture</span>
          </div>
          <div>
            <p className="qa-footer__copyright">© 2026 QUACKSAPP Messenger. Encrypted &amp; Distributed Architecture.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
