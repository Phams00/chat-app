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
}

module.exports = registerMessageHandlers;