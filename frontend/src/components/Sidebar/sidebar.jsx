import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { getMediaUrl } from '../../utils/media';
import './Sidebar.css';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
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
          className={`sidebar-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
          type="button"
          title="Pengaturan akun"
          aria-label="Pengaturan akun"
          onClick={() => navigate('/settings')}
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </aside>
  );
}