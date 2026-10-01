import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import AuthPage from './screen/Login/AuthPage';
import ChatList from './screen/ChatList/Chatlist';
import ChatRoom from './screen/ChatRoom/ChatRoom';
import useAuthStore from './store/authStore';

function ProtectedRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
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
          <Route path="/" element={<ChatList />} />
          <Route path="/chats/:id" element={<ChatRoom />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;