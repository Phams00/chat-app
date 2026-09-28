// entry point: gabungkan HTTP server + Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const socketAuthMiddleware = require('./src/sockets/auth.socket');
const registerMessageHandlers = require('./src/sockets/message.socket');
const { addOnlineUser, removeOnlineUser, isUserOnline, getOnlineUserIds } = require('./src/sockets/presence.socket');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // sementara izinkan semua, nanti dipersempit
});

io.use(socketAuthMiddleware); //supaya setiap koneksi WAJIB lolos token dulu

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Cek SEBELUM menambahkan: apakah ini koneksi pertama user ini?
  const wasOffline = !isUserOnline(socket.userId);
  addOnlineUser(socket.userId, socket.id);

  // Snapshot: kirim daftar online saat ini hanya ke socket yang baru connect
  socket.emit('online_users_list', getOnlineUserIds());

  // Delta: kabari yang lain HANYA kalau user ini benar-benar baru online
  if (wasOffline) {
    socket.broadcast.emit('user_online', { userId: socket.userId });

  io.emit('user_online', { userId: socket.userId });

  registerMessageHandlers(io, socket);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Kabari offline HANYA kalau semua tab/device user ini sudah tertutup
    if (!isUserOnline(socket.userId)) {
      io.emit('user_offline', { userId: socket.userId });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});