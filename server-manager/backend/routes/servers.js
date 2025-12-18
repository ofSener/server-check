const express = require('express');
const router = express.Router();

// Tüm sunucuları listele
router.get('/', (req, res) => {
  const agentManager = req.app.get('agentManager');
  const servers = agentManager.getAllServers();

  res.json({
    success: true,
    data: servers,
    stats: {
      total: agentManager.getTotalCount(),
      online: agentManager.getOnlineCount()
    }
  });
});

// Tek sunucu detayı
router.get('/:id', (req, res) => {
  const agentManager = req.app.get('agentManager');
  const server = agentManager.getServer(req.params.id);

  if (!server) {
    return res.status(404).json({
      success: false,
      error: 'Sunucu bulunamadı'
    });
  }

  res.json({
    success: true,
    data: server
  });
});

// Sunucu metriklerini al
router.get('/:id/metrics', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const result = await agentManager.sendCommand(req.params.id, 'getMetrics');

  res.json(result);
});

// Sunucu uygulama durumu
router.get('/:id/app/status', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const result = await agentManager.sendCommand(req.params.id, 'getAppStatus');

  res.json(result);
});

// WPP Connect durumu
router.get('/:id/wpp/status', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const result = await agentManager.sendCommand(req.params.id, 'getWppStatus');

  res.json(result);
});

module.exports = router;
