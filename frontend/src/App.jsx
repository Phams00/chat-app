import { useRef, useState } from 'react';
import axios from 'axios';
import ChatRoom from './screen/ChatRoom/ChatRoom';
import { connectSocket } from './services/socket';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3000/api`;

function App() {
  const [phoneNumber, setPhoneNumber] = useState('081234567890');
  const [password, setPassword] = useState('rahasia123');
  const [token, setToken] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Belum login');
  const [showResponsiveChat, setShowResponsiveChat] = useState(false);
  const socketRef = useRef(null);

  async function handleLogin() {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { phoneNumber, password });
      setToken(response.data.token);
      setStatus(`Login berhasil sebagai ${response.data.user.name}`);
      const socket = connectSocket(response.data.token);
      socketRef.current = socket;

      socket.on('connect', () => setStatus('Socket terhubung'));
      socket.on('connect_error', (error) => setStatus(`Socket gagal connect: ${error.message}`));
      socket.on('new_message', (message) => setMessages((previous) => [...previous, message]));
      socket.on('message_error', (error) => setStatus(`Error kirim pesan: ${error.error}`));
    } catch (error) {
      setStatus(`Login gagal: ${error.response?.data?.error || error.message}`);
    }
  }

  function handleJoinConversation() {
    if (!socketRef.current) return;
    socketRef.current.emit('join_conversation', conversationId);
    setStatus(`Join ke conversation ${conversationId}`);
  }

  function handleSendMessage() {
    if (!socketRef.current || !messageText.trim()) return;
    socketRef.current.emit('send_message', {
      conversationId,
      content: messageText,
      type: 'text',
    });
    setMessageText('');
  }

  if (showResponsiveChat) {
    return <ChatRoom onBack={() => setShowResponsiveChat(false)} />;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 500, margin: '0 auto' }}>
      <h1>Tes Chat App</h1>
      <button onClick={() => setShowResponsiveChat(true)} style={{ marginBottom: '1rem' }}>
        Buka tampilan chat responsif
      </button>
      <p style={{ color: 'gray' }}>Status: {status}</p>

      {!token && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3>1. Login</h3>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Nomor HP"
            style={{ display: 'block', marginBottom: 8, width: '100%' }}
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
              onChange={(event) => setConversationId(event.target.value)}
              placeholder="Paste conversationId dari Postman"
              style={{ display: 'block', marginBottom: 8, width: '100%' }}
            />
            <button onClick={handleJoinConversation}>Join</button>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3>3. Kirim Pesan</h3>
            <input
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Ketik pesan"
              style={{ display: 'block', marginBottom: 8, width: '100%' }}
            />
            <button onClick={handleSendMessage}>Kirim</button>
          </div>

          <div>
            <h3>Pesan Masuk</h3>
            {messages.length === 0 && <p style={{ color: 'gray' }}>Belum ada pesan</p>}
            {messages.map((message) => (
              <div key={message.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <strong>{message.sender.name}:</strong> {message.content}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
