import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AuthPage from './screen/Login/AuthPage';
import ChatList from './screen/ChatList/Chatlist';
import ChatRoom from './screen/ChatRoom/ChatRoom';
import Contacts from './screen/Contacts/Contacts';
import Settings from './screen/Settings/Settings';
import useAuthStore from './store/authStore';
import Sidebar from './components/Sidebar/sidebar';

function ProtectedRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? (
    <>
      <Sidebar />
      <div className="protected-content">
        <Outlet />
      </div>
    </>
  ) : (
    <Navigate to="/login" replace />
  );
}

function ChatWorkspace() {
  return (
    <>
      <ChatList />
      <Outlet />
    </>
  );
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route element={<ProtectedRoutes />}>
          <Route element={<ChatWorkspace />}>
            <Route index element={<ChatRoom />} />
            <Route path="chats/:id" element={<ChatRoom />} />
          </Route>
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;