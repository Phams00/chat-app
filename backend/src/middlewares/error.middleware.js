function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);

  const requestedStatus = Number(err.status);
  const status =
    Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 500
      ? requestedStatus
      : err.code === 'LIMIT_FILE_SIZE'
        ? 413
        : 500;
  const message =
    err.code === 'LIMIT_FILE_SIZE'
      ? 'Ukuran gambar status maksimal 10 MB'
      : status >= 500
        ? 'Terjadi kesalahan pada server'
        : err.message;

  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}

module.exports = errorMiddleware;
