import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { connectSocket } from '../../services/socket';
import './AuthPage.css';

function Icon({ children }) {
  return <span className="material-symbols-outlined">{children}</span>;
}

function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
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
        // Setelah register sukses, langsung login otomatis
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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <Icon>chat_bubble</Icon>
          </div>
          <h1>ChatApp</h1>
          <p>Ngobrol cepat, aman, dan realtime</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={isLogin ? 'active' : ''}
            onClick={() => switchMode('login')}
          >
            Masuk
          </button>
          <button
            type="button"
            className={!isLogin ? 'active' : ''}
            onClick={() => switchMode('register')}
          >
            Daftar
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="phoneNumber">Nomor HP</label>
            <input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="081234567890"
              autoComplete="tel"
            />
          </div>

          {!isLogin && (
            <div className="auth-field">
              <label htmlFor="name">Nama</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama lengkap"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={!canSubmit || loading}>
            {loading ? (
              <Icon>progress_activity</Icon>
            ) : (
              <>{isLogin ? 'Masuk' : 'Daftar'}</>
            )}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? (
            <>
              Belum punya akun?{' '}
              <button type="button" onClick={() => switchMode('register')}>
                Daftar sekarang
              </button>
            </>
          ) : (
            <>
              Sudah punya akun?{' '}
              <button type="button" onClick={() => switchMode('login')}>
                Masuk
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthPage;