const jwt = require('jsonwebtoken');

function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Token tidak ditemukan'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId; // nempel di socket, bukan di req
    next();
  } catch (err) {
    next(new Error('Token tidak valid'));
  }
}

module.exports = socketAuthMiddleware;