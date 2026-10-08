import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { connectSocket } from '../../services/socket';
import './AuthPage.css';

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [authMethod, setAuthMethod] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  const isLogin = mode === 'login';
  const canSubmit = isLogin
    ? phoneNumber.trim() && password.trim()
    : phoneNumber.trim() && name.trim() && password.trim();

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { phoneNumber, password });
        setAuth(res.data.token, res.data.user);
        connectSocket(res.data.token);
        navigate('/');
      } else {
        await api.post('/auth/register', { phoneNumber, name, password });
        const res = await api.post('/auth/login', { phoneNumber, password });
        setAuth(res.data.token, res.data.user);
        connectSocket(res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Terjadi kesalahan, coba lagi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="quacks-auth-page">
      <header className="quacks-header">
        <div className="quacks-brand-wrap">
          <div className="quacks-logo">
            <img
              alt="QuacksApp Mascot"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRTGh9nNvljfRRjFXnedqSDX0yY7q4iV0oDnPfanuxY21APBRqytKSuoOmpTqHzjErbR-9YA3OvXAR7tg0-ExPVNbnA3L8xq72awKtFmrCEt4n3o4oXL7eHKSYyCrb5qxRTDOnRBYMU4xtth02gA1Ii0CQJql3i23PuM8DAUzbQGZh-z_9lP-5HG2xC0TdclO40d2GDkE_pe9y3dXaScOnwV5ABhQ7kvoeTvyOAI8V6bLaHEyfuZHw1-2fv0oLNAhehpM"
            />
          </div>

          <div className="quacks-brand-copy">
            <div className="quacks-brand-row">
              <span>QuacksApp</span>
              <span className="brand-dot" />
            </div>
            <small>Private &amp; Decentralized Messenger</small>
          </div>
        </div>

        <div className="quacks-header-actions">
          <button type="button" className="header-button">
            <Icon>language</Icon>
            <span>ID / Indonesia</span>
          </button>
          <button type="button" className="header-button">
            <Icon>help_outline</Icon>
            <span>Bantuan</span>
          </button>
        </div>
      </header>

      <main className="quacks-auth-main">
        <div className="quacks-auth-column form-column">
          <div className="quacks-form-card">
            <div className="quacks-form-header">
              <div className="quacks-form-logo">
                <img
                  alt="Quacks Mascot"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDCylNJY1l5KoLpQeCP03rba_5Et5l1sRpfN-OOn_JvW7sfgrcsaItgq-nkCRiK4fifyzbIPtIX8lqfoO8mPYv0LN3pSSkLIzK-IrtM-gQvRmfWJafyOuDLqqrwoflrv5iW-BFIApqmmUVRCGRJSaV3i_qaO1RtzZaSg40dqC6TQZyp0uGa50ycMsC_DD_6AYu-kiT-D1DX5rkNiCAvHm5x0WD_fqpjay_JF1P6-o_QEfqdcrfGyFI0btn1Kkht2HKogpQ"
                />
              </div>

              <div>
                <h1>{isLogin ? 'Selamat Datang Kembali!' : 'Buat Akun QuacksApp'}</h1>
                <p>
                  {isLogin
                    ? 'Masuk untuk mulai mengobrol dengan aman dan privat.'
                    : 'Daftar sekarang untuk mulai chat dengan aman dan cepat.'}
                </p>
              </div>
            </div>

            <div className="quacks-auth-tabs" role="tablist">
              <button
                type="button"
                className={authMethod === 'phone' ? 'active' : ''}
                onClick={() => setAuthMethod('phone')}
              >
                <Icon>smartphone</Icon>
                <span>Nomor Ponsel</span>
              </button>
              <button
                type="button"
                className={authMethod === 'email' ? 'active' : ''}
                onClick={() => setAuthMethod('email')}
              >
                <Icon>alternate_email</Icon>
                <span>Email / Quacks ID</span>
              </button>
            </div>

            <form className="quacks-auth-form" onSubmit={handleSubmit}>
              {authMethod === 'phone' ? (
                <div className="auth-field">
                  <label htmlFor="phoneNumber">Nomor Telepon</label>
                  <div className="input-shell input-shell--phone">
                    <div className="country-prefix">
                      <span className="country-flag">🇮🇩</span>
                      <span>+62</span>
                      <Icon className="dropdown-icon">arrow_drop_down</Icon>
                    </div>
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="812 3456 7890"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              ) : (
                <div className="auth-field">
                  <label htmlFor="phoneNumber">Quacks ID atau Email</label>
                  <div className="input-shell">
                    <Icon>alternate_email</Icon>
                    <input
                      id="phoneNumber"
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="contoh: @username atau email@domain.com"
                      autoComplete="username"
                    />
                  </div>
                </div>
              )}

              {!isLogin && (
                <div className="auth-field">
                  <label htmlFor="name">Nama Lengkap</label>
                  <div className="input-shell">
                    <Icon>person</Icon>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="password">Kata Sandi</label>
                <div className="input-shell input-shell--password">
                  <Icon>lock</Icon>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? 'Masukkan kata sandi akun Anda' : 'Buat kata sandi minimal 6 karakter'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <Icon>{showPassword ? 'visibility' : 'visibility_off'}</Icon>
                  </button>
                </div>
              </div>

              <div className="auth-inline-row">
                <label className="remember-me">
                  <input type="checkbox" defaultChecked />
                  <span>Ingat saya di perangkat ini</span>
                </label>
                <a href="#">Lupa Kata Sandi?</a>
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={!canSubmit || loading}>
                <span>{loading ? 'Memproses...' : isLogin ? 'Masuk Sekarang' : 'Daftar Sekarang'}</span>
                <Icon>{loading ? 'progress_activity' : 'arrow_forward'}</Icon>
              </button>
            </form>

            <div className="auth-divider">
              <span>ATAU</span>
            </div>

            <button type="button" className="google-button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" fill="#EA4335" />
                <path d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" fill="#4285F4" />
                <path d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" fill="#FBBC05" />
                <path d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" fill="#34A853" />
              </svg>
              <span>Lanjutkan dengan Google</span>
            </button>

            <div className="quacks-auth-switch">
              {isLogin ? (
                <>
                  <span>Belum punya akun QuacksApp?</span>
                  <button type="button" onClick={() => switchMode('register')}>
                    Daftar di sini
                  </button>
                </>
              ) : (
                <>
                  <span>Sudah punya akun?</span>
                  <button type="button" onClick={() => switchMode('login')}>
                    Masuk
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="quacks-auth-column showcase-column">
          <div className="quacks-showcase">
            <div className="quacks-ducks" aria-hidden="true">
              <div className="duck duck-rain-1">🦆</div>
              <div className="duck duck-rain-2">🦆</div>
              <div className="duck duck-rain-3">🦆</div>
              <div className="duck duck-rain-4">🦆</div>
              <div className="duck duck-rain-5">🦆</div>
              <div className="duck duck-rain-6">🦆</div>
              <div className="duck duck-rain-7">🦆</div>
            </div>

            <div className="showcase-glow" />
            <div className="showcase-card glass-card showcase-card-top">
              <div className="showcase-item">
                <span className="showcase-icon">verified_user</span>
                <div>
                  <strong>Enkripsi end-to-end</strong>
                  <small>Pesan diamankan dari ujung ke ujung</small>
                </div>
              </div>
            </div>

            <div className="showcase-card glass-card showcase-card-bottom">
              <div className="showcase-item">
                <span className="showcase-icon">groups</span>
                <div>
                  <strong>Komunitas aktif</strong>
                  <small>5.8K pengguna online sekarang</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AuthPage;