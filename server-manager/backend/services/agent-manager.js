const EventEmitter = require('events');
const logger = require('./logger');

class AgentManager extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.agents = new Map(); // agentId -> { socket, data, lastSeen, metrics }
    this.config = {
      offlineThreshold: 30000, // 30 saniye
      cleanupInterval: 60000   // 1 dakika
    };

    // Periyodik temizlik
    setInterval(() => this.checkOfflineAgents(), this.config.cleanupInterval);
  }

  // Agent kaydı
  registerAgent(socket, data) {
    const { id, name } = data;

    logger.info(`Agent kaydediliyor: ${id} (${name})`);

    // Auth kontrolü
    const secret = socket.handshake.auth.secret;
    const expectedSecret = process.env.AGENT_SECRET || 'change-this-secret';

    if (secret !== expectedSecret) {
      logger.warn(`Agent ${id} geçersiz secret ile bağlanmaya çalıştı`);
      socket.disconnect(true);
      return;
    }

    // Daha önce kayıtlı mı kontrol et
    const existingAgent = this.agents.get(id);
    if (existingAgent && existingAgent.socket.connected) {
      logger.warn(`Agent ${id} zaten bağlı, eski bağlantı kapatılıyor`);
      existingAgent.socket.disconnect(true);
    }

    // Agent'ı kaydet
    this.agents.set(id, {
      socket: socket,
      data: {
        id: id,
        name: name,
        registeredAt: new Date().toISOString()
      },
      lastSeen: Date.now(),
      metrics: null,
      status: 'online'
    });

    // Socket'e agentId ekle
    socket.agentId = id;

    logger.info(`Agent kaydedildi: ${id}`);

    // Dashboard'a bildir
    this.emit('server:online', {
      id: id,
      name: name,
      timestamp: new Date().toISOString()
    });
  }

  // Metrik güncelleme
  handleMetrics(socket, data) {
    const agentId = data.agentId || socket.agentId;

    if (!agentId) {
      logger.warn('Metrik alındı fakat agentId yok');
      return;
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      logger.warn(`Bilinmeyen agent'tan metrik: ${agentId}`);
      return;
    }

    // Metrikleri güncelle
    agent.lastSeen = Date.now();
    agent.metrics = data;
    agent.status = 'online';

    // Dashboard'a gönder
    this.emit('server:update', {
      id: agentId,
      name: agent.data.name,
      status: 'online',
      lastSeen: new Date().toISOString(),
      system: data.system,
      app: data.app,
      wpp: data.wpp
    });
  }

  // Bağlantı kopması
  handleDisconnect(socket) {
    const agentId = socket.agentId;

    if (!agentId) return;

    logger.warn(`Agent bağlantısı koptu: ${agentId}`);

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'offline';

      // Dashboard'a bildir
      this.emit('server:offline', {
        id: agentId,
        name: agent.data.name,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Offline agent kontrolü
  checkOfflineAgents() {
    const now = Date.now();

    for (const [agentId, agent] of this.agents) {
      if (now - agent.lastSeen > this.config.offlineThreshold) {
        if (agent.status !== 'offline') {
          agent.status = 'offline';
          logger.warn(`Agent offline: ${agentId}`);

          this.emit('server:offline', {
            id: agentId,
            name: agent.data.name,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  // Tüm sunucuları getir
  getAllServers() {
    const servers = [];

    for (const [agentId, agent] of this.agents) {
      servers.push({
        id: agentId,
        name: agent.data.name,
        status: agent.status,
        lastSeen: new Date(agent.lastSeen).toISOString(),
        metrics: agent.metrics
      });
    }

    return servers;
  }

  // Tek sunucu getir
  getServer(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    return {
      id: agentId,
      name: agent.data.name,
      status: agent.status,
      lastSeen: new Date(agent.lastSeen).toISOString(),
      metrics: agent.metrics
    };
  }

  // Agent'a komut gönder
  async sendCommand(agentId, command, data = {}) {
    const agent = this.agents.get(agentId);

    if (!agent) {
      return { success: false, error: 'Agent bulunamadı' };
    }

    if (agent.status !== 'online' || !agent.socket.connected) {
      return { success: false, error: 'Agent çevrimdışı' };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Zaman aşımı' });
      }, 30000); // 30 saniye timeout

      agent.socket.emit(`command:${command}`, data, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  // Tüm agent'lara komut gönder
  async broadcastCommand(command, data = {}) {
    const results = {};

    for (const [agentId] of this.agents) {
      results[agentId] = await this.sendCommand(agentId, command, data);
    }

    return results;
  }

  // Agent sayısı
  getOnlineCount() {
    let count = 0;
    for (const agent of this.agents.values()) {
      if (agent.status === 'online') count++;
    }
    return count;
  }

  getTotalCount() {
    return this.agents.size;
  }
}

module.exports = AgentManager;
