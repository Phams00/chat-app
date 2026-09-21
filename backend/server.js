// entry point: gabungkan HTTP server + Socket.io
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // sementara izinkan semua, nanti dipersempit
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // event dummy untuk tes koneksi
  socket.on('ping_test', (data) => {
    console.log('Diterima dari client:', data);
    socket.emit('pong_test', { message: 'Halo dari backend!' });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});