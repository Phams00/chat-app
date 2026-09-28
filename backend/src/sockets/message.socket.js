const messageService = require('../services/messageService');

function registerMessageHandlers(io, socket) {
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('send_message', async ({ conversationId, content, type }) => {
    try {
      const message = await messageService.saveMessage(
        conversationId,
        socket.userId,
        content,
        type
      );
      io.to(conversationId).emit('new_message', message);
    } catch (err) {
      socket.emit('message_error', { error: err.message });
    }
  });

  // --- Typing indicator ---
  socket.on('typing_start', ({ conversationId }) => {
    // broadcast KE SEMUA di room KECUALI pengirim sendiri
    socket.to(conversationId).emit('user_typing', { userId: socket.userId, conversationId });
  });

  socket.on('typing_stop', ({ conversationId }) => {
    socket.to(conversationId).emit('user_stop_typing', { userId: socket.userId, conversationId });
  });

  // --- Read receipt ---
  socket.on('mark_as_read', async ({ conversationId, messageId }) => {
    try {
      const updated = await messageService.markAsRead(messageId, socket.userId);
      io.to(conversationId).emit('message_read', {
        messageId: updated.id,
        readAt: updated.readAt,
      });
    } catch (err) {
      socket.emit('message_error', { error: err.message });
    }
  });
}

module.exports = registerMessageHandlers;