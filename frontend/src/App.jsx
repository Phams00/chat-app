import { useEffect, useState } from 'react';
import socket from './services/socket';

function App() {
  const [reply, setReply] = useState('Menunggu balasan dari backend...');

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Terhubung ke backend, socket id:', socket.id);
      socket.emit('ping_test', { message: 'Halo dari frontend!' });
    });

    socket.on('pong_test', (data) => {
      setReply(data.message);
    });

    return () => {
      socket.off('connect');
      socket.off('pong_test');
    };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Tes Koneksi Socket.io</h1>
      <p>Balasan backend: <strong>{reply}</strong></p>
    </div>
  );
}

export default App;