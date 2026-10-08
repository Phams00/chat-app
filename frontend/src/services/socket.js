import { io } from 'socket.io-client';
import usePresenceStore from '../store/presenceStore';

let socket = null;
const socketListeners = new Set();

function subscribeSocket(listener) {
  socketListeners.add(listener);
  return () => socketListeners.delete(listener);
}

function notifySocketListeners() {
  socketListeners.forEach((listener) => listener());
}

export function connectSocket(token) {
  if (!token) return null;

  if (socket) {
    if (socket.auth?.token !== token) {
      socket.auth = { token };
      if (socket.connected) socket.disconnect();
      socket.connect();
    }
    return socket;
  }

  const socketHost = window.location.hostname || 'localhost';
  socket = io(`http://${socketHost}:3000`, { auth: { token } });
  notifySocketListeners();

  socket.on('online_users_list', (ids) => {
    usePresenceStore.getState().setOnlineList(ids);
  });
  socket.on('user_online', ({ userId }) => {
    usePresenceStore.getState().addOnline(userId);
  });
  socket.on('user_offline', ({ userId }) => {
    usePresenceStore.getState().removeOnline(userId);
  });

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;

  socket.disconnect();
  socket = null;
  notifySocketListeners();
}

export function getSocket() {
  return socket;
}

export { subscribeSocket };