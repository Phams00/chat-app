const statusService = require('../services/statusService');

async function list(req, res) {
  res.json(await statusService.listStatuses(req.user.id));
}

async function create(req, res) {
  const { user, userIds } = await statusService.getStatusAudience(req.user.id);
  const status = await statusService.createStatus(req.user.id, req.statusContent, req.file);
  const io = req.app.get('io');
  userIds.forEach((userId) => {
    io.to(`user:${userId}`).emit('status_created', { status, user });
  });
  res.status(201).json(status);
}

async function media(req, res) {
  const mediaPath = await statusService.getStatusMediaPath(req.user.id, req.params.id);
  res.sendFile(mediaPath);
}

async function remove(req, res) {
  const { userIds } = await statusService.getStatusAudience(req.user.id);
  await statusService.deleteStatus(req.user.id, req.params.id);
  const io = req.app.get('io');
  userIds.forEach((userId) => {
    io.to(`user:${userId}`).emit('status_deleted', {
      statusId: req.params.id,
      userId: req.user.id,
    });
  });
  res.status(204).end();
}

module.exports = { list, create, media, remove };
