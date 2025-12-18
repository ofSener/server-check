const express = require('express');
const router = express.Router();

// Tüm sunucuların özet metrikleri
router.get('/summary', (req, res) => {
  const agentManager = req.app.get('agentManager');
  const servers = agentManager.getAllServers();

  const summary = {
    totalServers: servers.length,
    onlineServers: servers.filter(s => s.status === 'online').length,
    offlineServers: servers.filter(s => s.status === 'offline').length,
    averageCpu: 0,
    averageMemory: 0,
    appsRunning: 0,
    wppActive: 0
  };

  let cpuSum = 0;
  let memSum = 0;
  let cpuCount = 0;

  for (const server of servers) {
    if (server.metrics && server.metrics.system) {
      cpuSum += server.metrics.system.cpu?.usage || 0;
      memSum += server.metrics.system.memory?.usagePercent || 0;
      cpuCount++;
    }

    if (server.metrics?.app?.running) {
      summary.appsRunning++;
    }

    if (server.metrics?.wpp?.overall === 'active') {
      summary.wppActive++;
    }
  }

  if (cpuCount > 0) {
    summary.averageCpu = Math.round((cpuSum / cpuCount) * 100) / 100;
    summary.averageMemory = Math.round((memSum / cpuCount) * 100) / 100;
  }

  res.json({
    success: true,
    data: summary
  });
});

// Belirli bir sunucunun metrik geçmişi (MongoDB gerektirir)
router.get('/:serverId/history', async (req, res) => {
  const { serverId } = req.params;
  const { hours = 24 } = req.query;

  // Bu özellik için MongoDB model gerekli
  // Şimdilik boş dönüyoruz
  res.json({
    success: true,
    data: [],
    message: 'Metrik geçmişi için MongoDB bağlantısı gerekli'
  });
});

// Anlık tüm metrikler
router.get('/realtime', (req, res) => {
  const agentManager = req.app.get('agentManager');
  const servers = agentManager.getAllServers();

  const metrics = servers.map(server => ({
    id: server.id,
    name: server.name,
    status: server.status,
    cpu: server.metrics?.system?.cpu?.usage || null,
    memory: server.metrics?.system?.memory?.usagePercent || null,
    appRunning: server.metrics?.app?.running || false,
    wppStatus: server.metrics?.wpp?.overall || 'unknown'
  }));

  res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
