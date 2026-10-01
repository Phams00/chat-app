const messageService = require('../services/messageService');
const { assertMember } = require('../services/conversationService');

function registerMessageHandlers(io, socket) {
  socket.on('join_conversation', async (conversationId) => {
    try {
      await assertMember(conversationId, socket.userId);
      socket.join(conversationId);
    } catch (err) {
      socket.emit('message_error', { error: err.message });
    }
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(conversationId);
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
  socket.on('typing_start', async ({ conversationId }) => {
    try {
      await assertMember(conversationId, socket.userId);
      socket.to(conversationId).emit('user_typing', { userId: socket.userId, conversationId });
    } catch (err) {
      socket.emit('message_error', { error: err.message });
    }
  });

  socket.on('typing_stop', async ({ conversationId }) => {
    try {
      await assertMember(conversationId, socket.userId);
      socket.to(conversationId).emit('user_stop_typing', { userId: socket.userId, conversationId });
    } catch (err) {
      socket.emit('message_error', { error: err.message });
    }
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