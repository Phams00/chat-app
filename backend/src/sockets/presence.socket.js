// Menyimpan siapa saja yang online: userId -> Set(socketId)
// Pakai Set karena 1 user bisa buka beberapa tab/device sekaligus
const onlineUsers = new Map();

function addOnlineUser(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineUser(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId); // user benar-benar offline, semua tab ditutup
  }
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

module.exports = { addOnlineUser, removeOnlineUser, isUserOnline };