// Menyimpan siapa saja yang online: userId -> Set(socketId)
// Pakai Set karena 1 user bisa buka beberapa tab/device sekaligus
const onlineUsers = new Map();
const presenceVisibility = new Map();

function addOnlineUser(userId, socketId, showOnlineStatus = true) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
  presenceVisibility.set(userId, showOnlineStatus);
}

function removeOnlineUser(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId); // user benar-benar offline, semua tab ditutup
    presenceVisibility.delete(userId);
  }
}

function setPresenceVisibility(userId, visible) {
  const previous = presenceVisibility.get(userId) ?? true;
  presenceVisibility.set(userId, visible);
  return previous;
}

function isPresenceVisible(userId) {
  return presenceVisibility.get(userId) ?? true;
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys()).filter(isPresenceVisible);
}

module.exports = {
  addOnlineUser,
  removeOnlineUser,
  setPresenceVisibility,
  isPresenceVisible,
  isUserOnline,
  getOnlineUserIds,
};