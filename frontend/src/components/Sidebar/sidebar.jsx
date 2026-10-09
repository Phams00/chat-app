import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import './Sidebar.css';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const menuItems = [
    { path: '/', icon: 'chat_bubble', title: 'Chats' },
    { path: '/contacts', icon: 'people', title: 'Kontak' },
  ];

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <div className="sidebar-top">
        <button
          className="sidebar-logo"
          type="button"
          aria-label="Buka daftar chat"
          onClick={() => navigate('/')}
        >
          <img src="/quacks-logo-hd.jpeg" alt="" />
        </button>

        <nav className="sidebar-nav">
          {menuItems.map(({ path, icon, title }) => (
            <button
              key={path}
              className={`sidebar-nav-item ${
                location.pathname === path || (path === '/' && location.pathname.startsWith('/chats/'))
                  ? 'active'
                  : ''
              }`}
              type="button"
              onClick={() => navigate(path)}
              title={title}
              aria-label={title}
            >
              <span className="material-symbols-outlined">
                {icon}
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sidebar-bottom">
        <button
          className="sidebar-profile"
          type="button"
          title={`Keluar atau ganti akun${user?.name ? ` (${user.name})` : ''}`}
          aria-label="Keluar atau ganti akun"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" />
          ) : (
            <span className="sidebar-profile-initial">
              {(user?.name || '?').trim().charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}