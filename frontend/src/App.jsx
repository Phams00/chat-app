import { useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [phoneNumber, setPhoneNumber] = useState('081234567890');
  const [password, setPassword] = useState('rahasia123');
  const [token, setToken] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Belum login');

  const socketRef = useRef(null); // simpan instance socket tanpa trigger re-render

  async function handleLogin() {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { phoneNumber, password });
      setToken(res.data.token);
      setStatus(`Login berhasil sebagai ${res.data.user.name}`);
      connectSocket(res.data.token);
    } catch (err) {
      setStatus(`Login gagal: ${err.response?.data?.error || err.message}`);
    }
  }

  function connectSocket(authToken) {
    // Kirim token lewat "auth" saat handshake — ini yang dibaca socketAuthMiddleware di backend
    const socket = io('http://localhost:3000', {
      auth: { token: authToken },
    });

    socket.on('connect', () => {
      setStatus('Socket terhubung');
    });

    socket.on('connect_error', (err) => {
      setStatus(`Socket gagal connect: ${err.message}`);
    });

    socket.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('message_error', (err) => {
      setStatus(`Error kirim pesan: ${err.error}`);
    });

    socketRef.current = socket;
  }

  function handleJoinConversation() {
    if (!socketRef.current) return;
    socketRef.current.emit('join_conversation', conversationId);
    setStatus(`Join ke conversation ${conversationId}`);
  }

  function handleSendMessage() {
    if (!socketRef.current) return;
    socketRef.current.emit('send_message', {
      conversationId,
      content: messageText,
      type: 'text',
    });
    setMessageText('');
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 500 }}>
      <h1>Tes Chat App</h1>
      <p style={{ color: 'gray' }}>Status: {status}</p>

      {!token && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3>1. Login</h3>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="Nomor HP"
            style={{ display: 'block', marginBottom: 8, width: '100%' }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            style={{ display: 'block', marginBottom: 8, width: '100%' }}
          />
          <button onClick={handleLogin}>Login</button>
        </div>
      )}

      {token && (
        <>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3>2. Join Conversation</h3>
            <input
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
              placeholder="Paste conversationId dari Postman"
              style={{ display: 'block', marginBottom: 8, width: '100%' }}
            />
            <button onClick={handleJoinConversation}>Join</button>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3>3. Kirim Pesan</h3>
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Ketik pesan"
              style={{ display: 'block', marginBottom: 8, width: '100%' }}
            />
            <button onClick={handleSendMessage}>Kirim</button>
          </div>

          <div>
            <h3>Pesan Masuk</h3>
            {messages.length === 0 && <p style={{ color: 'gray' }}>Belum ada pesan</p>}
            {messages.map((msg) => (
              <div key={msg.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <strong>{msg.sender.name}:</strong> {msg.content}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;