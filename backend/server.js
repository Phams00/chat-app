// entry point: gabungkan HTTP server + Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const socketAuthMiddleware = require('./src/sockets/auth.socket');
const registerMessageHandlers = require('./src/sockets/message.socket');
const prisma = require('./src/config/prisma');
const {
  addOnlineUser,
  removeOnlineUser,
  setPresenceVisibility,
  isPresenceVisible,
  isUserOnline,
  getOnlineUserIds,
} = require('./src/sockets/presence.socket');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // sementara izinkan semua, nanti dipersempit
});
app.set('io', io);

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // event dummy untuk tes koneksi
  socket.on('ping_test', (data) => {
    console.log('Diterima dari client:', data);
    socket.emit('pong_test', { message: 'Halo dari backend!' });
  });

  registerMessageHandlers(io, socket);

  async function registerPresence() {
    let showOnlineStatus = true;
    try {
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { preferences: true },
      });
      showOnlineStatus = user?.preferences?.showOnlineStatus !== false;
    } catch {
      showOnlineStatus = false;
    }
    if (!socket.connected) return;

    // Check after the query to avoid races between simultaneous device connections.
    const wasOffline = !isUserOnline(socket.userId);
    addOnlineUser(socket.userId, socket.id, showOnlineStatus);
    socket.emit('online_users_list', getOnlineUserIds());
    if (wasOffline && showOnlineStatus) {
      socket.broadcast.emit('user_online', { userId: socket.userId });
    }
  }

  registerPresence();

  socket.on('refresh_presence_visibility', async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { preferences: true },
      });
      const visible = user?.preferences?.showOnlineStatus !== false;
      const wasVisible = setPresenceVisibility(socket.userId, visible);
      if (wasVisible !== visible && isUserOnline(socket.userId)) {
        io.emit(visible ? 'user_online' : 'user_offline', { userId: socket.userId });
      }
    } catch {
      socket.emit('message_error', { error: 'Status privasi belum dapat diperbarui.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const wasVisible = isPresenceVisible(socket.userId);
    removeOnlineUser(socket.userId, socket.id);

    // Kabari offline HANYA kalau semua tab/device user ini sudah tertutup
    if (!isUserOnline(socket.userId) && wasVisible) {
      io.emit('user_offline', { userId: socket.userId });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});