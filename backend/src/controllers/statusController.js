const statusService = require('../services/statusService');

async function list(req, res) {
  res.json(await statusService.listStatuses(req.user.id));
}

async function create(req, res) {
  const status = await statusService.createStatus(req.user.id, req.statusContent, req.file);
  res.status(201).json(status);
}

async function media(req, res) {
  const mediaPath = await statusService.getStatusMediaPath(req.user.id, req.params.id);
  res.sendFile(mediaPath);
}

async function remove(req, res) {
  await statusService.deleteStatus(req.user.id, req.params.id);
  res.status(204).end();
}

module.exports = { list, create, media, remove };
