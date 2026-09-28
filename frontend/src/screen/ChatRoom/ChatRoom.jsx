import { useState } from "react";
import "./ChatRoom.css";

const mayaUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAFl0EN5eMPp8D2EzGiTfSd5mXSfYT_BGxHMkSS1nzXzrSn29zmv1Xj7tBHMthzROjyrA8ncWu9izh9MDzSO4XVM9vqHJ8JlQsmnVmq4kz4JvWGSh49-mOt9sETmCVUifoIxqmQ2qtCMRbhvXv6OQmCofSUdwGXj3uj5sWIl6TneHvVP2PIUffjkm6XhYebTBIDfu0BqR_kimbgfUDlVehZgxyx94XL-wFRbxRENLXJvmeXQbraAmhl_w";

const cafeUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDcY2lK0o4xRx3RmiJmqrL9D57Yv32nOSUuFT4jJBzurJwtC6XL4HArgrAKTPz3MPDVgRh9wfI1fkT9oxXxYdd9Cm9c8b-j1fGwDQt5Lx-JkzUK4mwnPwo7_SYGrxqN2NeMNxQItz2XbT_M3sl2r5etgJIgluzHa8UU0YsNWhL7YHkvr66-QhexsiOrurrUFCWgTRpN3qgHsO38tqUhs5I9DyeEaGlQHhs1hKneHUT5Y6rRrZcvecaw9Q";

function Icon({ children, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function ChatRoom() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);

  const sendMessage = (e) => {
    e?.preventDefault();

    const text = message.trim();
    if (!text) return;

    const now = new Date();
    const time = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [...prev, { text, time }]);
    setMessage("");
    setAttachmentsOpen(false);
  };

  return (
    <div className="chat-page">
      <div className="chat-app">
        <header className="chat-header">
  <button className="back-button" aria-label="Kembali">
    <Icon>arrow_back_ios_new</Icon>
  </button>

  <div className="chat-contact">
    <div className="chat-avatar">
      <img src={mayaUrl} alt="Maya Salsabila" />
      <span className="online-dot" />
    </div>

    <div className="chat-contact-info">
      <div className="chat-contact-name">
        Maya Salsabila
        <Icon className="verified">verified</Icon>
      </div>

      <div className="chat-contact-status">
        <span className="status-dot" />
        Online • Mengetik...
      </div>
    </div>
  </div>

  <div className="chat-actions">
    <button aria-label="Video call">
      <Icon>videocam</Icon>
    </button>

    <button aria-label="Telepon">
      <Icon>call</Icon>
    </button>

    <button aria-label="Menu">
      <Icon>more_vert</Icon>
    </button>
  </div>
</header>

<main className="chat-main">

          <section className="messages">
            <div className="date-pill">HARI INI</div>

            <div className="message incoming">
              <p>Halo! Nanti sore kita jadi ngopi di cafe biasa kan? ☕✨</p>
              <span>15:42</span>
            </div>

            <div className="message outgoing">
              <p>
                Jadi dong! Aku lagi selesaikan revisi desain aplikasi sebentar.
                Siap meluncur jam 4! 🚀
              </p>
              <span>
                15:44 <Icon>done_all</Icon>
              </span>
            </div>

            <div className="cafe-card">
              <div className="cafe-image-wrap">
                <img src={cafeUrl} alt="Cafe" />
                <span className="cafe-tag">
                  <Icon>local_cafe</Icon>
                  Artisan Spot
                </span>
              </div>

              <p>
                Tempatnya baru didekor ulang lho, lucu banget! Spot favorit kita
                di pojokan masih kosong nih.
              </p>

              <div className="reaction">💗 1</div>
              <span className="cafe-time">15:46</span>
            </div>

            <div className="voice-message">
              <button
                className="voice-play"
                aria-label="Putar rekaman"
                onClick={() => setPlayingVoice((value) => !value)}
              >
                <Icon>{playingVoice ? "pause" : "play_arrow"}</Icon>
              </button>

              <div className="voice-content">
                <div className="wave">
                  {[3, 5, 7, 4, 6, 8, 5, 7, 4, 6, 8, 3, 5, 7, 4, 6].map(
                    (height, index) => (
                      <span
                        key={index}
                        style={{ height: `${height * 3}px` }}
                      />
                    )
                  )}
                </div>

                <div className="voice-meta">
                  <span>0:18</span>
                  <span>
                    15:48 <Icon>done_all</Icon>
                  </span>
                </div>
              </div>
            </div>

            {messages.map((item, index) => (
              <div className="message outgoing" key={`${item.time}-${index}`}>
                <p>{item.text}</p>
                <span>
                  {item.time} <Icon>done</Icon>
                </span>
              </div>
            ))}
          </section>

          {attachmentsOpen && (
            <div className="attachment-drawer">
              {[
                ["photo_camera", "Kamera"],
                ["image", "Galeri"],
                ["description", "Dokumen"],
                ["location_on", "Lokasi"],
              ].map(([icon, label]) => (
                <button key={label}>
                  <span className="attachment-icon">
                    <Icon>{icon}</Icon>
                  </span>
                  <small>{label}</small>
                </button>
              ))}
            </div>
          )}

          <form className="message-dock" onSubmit={sendMessage}>
            <button
              type="button"
              className={`round-action ${attachmentsOpen ? "active" : ""}`}
              aria-label="Lampiran"
              onClick={() => setAttachmentsOpen((value) => !value)}
            >
              <Icon>{attachmentsOpen ? "close" : "add"}</Icon>
            </button>

            <div className="input-pill">
              <button type="button" aria-label="Emoji">
                <Icon>sentiment_satisfied</Icon>
              </button>

              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ketik pesan..."
              />

              <button type="button" aria-label="Stiker">
                <Icon>note_add</Icon>
              </button>
            </div>

            <button
              type="submit"
              className="send-button"
              aria-label={message.trim() ? "Kirim Pesan" : "Rekam Suara"}
            >
              <Icon>{message.trim() ? "send" : "mic"}</Icon>
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default ChatRoom;
