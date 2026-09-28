// entry point: gabungkan HTTP server + Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const socketAuthMiddleware = require('./src/sockets/auth.socket');
const registerMessageHandlers = require('./src/sockets/message.socket');
const { addOnlineUser, removeOnlineUser } = require('./src/sockets/presence.socket');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // sementara izinkan semua, nanti dipersempit
});

io.use(socketAuthMiddleware); //supaya setiap koneksi WAJIB lolos token dulu

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  io.emit('user_online', { userId: socket.userId });

  registerMessageHandlers(io, socket);
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});