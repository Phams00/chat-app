function asyncMiddleware(handler) {
  return function handleAsync(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncMiddleware;
