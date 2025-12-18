const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// Uygulamayı başlat
router.post('/:serverId/app/start', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverId } = req.params;

  logger.info(`Komut: ${serverId} - Uygulamayı başlat`);

  const result = await agentManager.sendCommand(serverId, 'startApp');
  res.json(result);
});

// Uygulamayı durdur
router.post('/:serverId/app/stop', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverId } = req.params;

  logger.info(`Komut: ${serverId} - Uygulamayı durdur`);

  const result = await agentManager.sendCommand(serverId, 'stopApp');
  res.json(result);
});

// Uygulamayı yeniden başlat
router.post('/:serverId/app/restart', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverId } = req.params;

  logger.info(`Komut: ${serverId} - Uygulamayı yeniden başlat`);

  const result = await agentManager.sendCommand(serverId, 'restartApp');
  res.json(result);
});

// WPP Connect'i yeniden başlat
router.post('/:serverId/wpp/restart', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverId } = req.params;

  logger.info(`Komut: ${serverId} - WPP Connect yeniden başlat`);

  const result = await agentManager.sendCommand(serverId, 'restartWpp');
  res.json(result);
});

// Güncelleme yap
router.post('/:serverId/update', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverId } = req.params;
  const { downloadUrl, version } = req.body;

  if (!downloadUrl) {
    return res.status(400).json({
      success: false,
      error: 'downloadUrl gerekli'
    });
  }

  logger.info(`Komut: ${serverId} - Güncelleme v${version}`);

  const result = await agentManager.sendCommand(serverId, 'update', {
    downloadUrl,
    version
  });

  res.json(result);
});

// Toplu güncelleme (tüm sunuculara)
router.post('/update-all', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { downloadUrl, version } = req.body;

  if (!downloadUrl) {
    return res.status(400).json({
      success: false,
      error: 'downloadUrl gerekli'
    });
  }

  logger.info(`Toplu güncelleme başlatıldı: v${version}`);

  const results = await agentManager.broadcastCommand('update', {
    downloadUrl,
    version
  });

  res.json({
    success: true,
    results: results
  });
});

// Agent'ı yeniden başlat
router.post('/:serverId/agent/restart', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverId } = req.params;

  logger.info(`Komut: ${serverId} - Agent yeniden başlat`);

  const result = await agentManager.sendCommand(serverId, 'restartAgent');
  res.json(result);
});

// Toplu komut gönder
router.post('/batch', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { serverIds, command, data } = req.body;

  const allowedCommands = [
    'startApp', 'stopApp', 'restartApp',
    'restartWpp', 'getMetrics', 'getAppStatus', 'getWppStatus'
  ];

  if (!allowedCommands.includes(command)) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz komut'
    });
  }

  logger.info(`Toplu komut: ${command} -> ${serverIds.length} sunucu`);

  const results = {};
  for (const serverId of serverIds) {
    results[serverId] = await agentManager.sendCommand(serverId, command, data);
  }

  res.json({
    success: true,
    results: results
  });
});

module.exports = router;
