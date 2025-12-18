const { io } = require('socket.io-client');
const config = require('../config/default');
const logger = require('./logger');
const monitor = require('./monitor');
const processManager = require('./process');
const wppConnect = require('./wppconnect');
const updater = require('./updater');

class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.metricsInterval = null;
  }

  // Merkez sunucuya bağlan
  connect() {
    logger.info(`Merkez sunucuya bağlanılıyor: ${config.server.url}`);

    this.socket = io(config.server.url, {
      auth: {
        agentId: config.agent.id,
        agentName: config.agent.name,
        secret: config.agent.secret
      },
      reconnection: true,
      reconnectionDelay: config.server.reconnectInterval,
      reconnectionAttempts: Infinity
    });

    this.setupEventHandlers();
    return this;
  }

  // Event handler'ları ayarla
  setupEventHandlers() {
    // Bağlantı başarılı
    this.socket.on('connect', () => {
      logger.info('Merkez sunucuya bağlandı');
      this.connected = true;

      // Kendini tanıt
      this.socket.emit('agent:register', {
        id: config.agent.id,
        name: config.agent.name,
        timestamp: new Date().toISOString()
      });

      // Metrik göndermeye başla
      this.startMetricsReporting();
    });

    // Bağlantı koptu
    this.socket.on('disconnect', (reason) => {
      logger.warn(`Bağlantı koptu: ${reason}`);
      this.connected = false;
      this.stopMetricsReporting();
    });

    // Bağlantı hatası
    this.socket.on('connect_error', (error) => {
      logger.error(`Bağlantı hatası: ${error.message}`);
    });

    // Yeniden bağlanma
    this.socket.on('reconnect', (attemptNumber) => {
      logger.info(`Yeniden bağlandı (deneme: ${attemptNumber})`);
    });

    // --- KOMUTLAR ---

    // Sistem metrikleri iste
    this.socket.on('command:getMetrics', async (callback) => {
      try {
        const metrics = await monitor.getSystemMetrics();
        callback({ success: true, data: metrics });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Uygulama durumunu iste
    this.socket.on('command:getAppStatus', async (callback) => {
      try {
        const status = await processManager.getAppStatus();
        callback({ success: true, data: status });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Uygulamayı başlat
    this.socket.on('command:startApp', async (callback) => {
      logger.info('Komut alındı: Uygulamayı başlat');
      try {
        const result = await processManager.startApp();
        callback(result);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Uygulamayı durdur
    this.socket.on('command:stopApp', async (callback) => {
      logger.info('Komut alındı: Uygulamayı durdur');
      try {
        const result = await processManager.stopApp();
        callback(result);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Uygulamayı yeniden başlat
    this.socket.on('command:restartApp', async (callback) => {
      logger.info('Komut alındı: Uygulamayı yeniden başlat');
      try {
        const result = await processManager.restartApp();
        callback(result);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // WPP Connect durumunu iste
    this.socket.on('command:getWppStatus', async (callback) => {
      try {
        const status = await wppConnect.getStatus();
        callback({ success: true, data: status });
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // WPP Connect'i yeniden başlat
    this.socket.on('command:restartWpp', async (callback) => {
      logger.info('Komut alındı: WPP Connect yeniden başlat');
      try {
        const result = await wppConnect.restart();
        callback(result);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Güncelleme yap
    this.socket.on('command:update', async (data, callback) => {
      logger.info('Komut alındı: Güncelleme');
      try {
        const result = await updater.update(data);
        callback(result);
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Agent'ı yeniden başlat
    this.socket.on('command:restartAgent', async (callback) => {
      logger.info('Komut alındı: Agent yeniden başlat');
      callback({ success: true, message: 'Agent yeniden başlatılıyor' });

      // 2 saniye sonra kendi kendini yeniden başlat
      setTimeout(() => {
        process.exit(0); // Windows Service otomatik yeniden başlatır
      }, 2000);
    });

    // Özel komut çalıştır
    this.socket.on('command:exec', async (data, callback) => {
      logger.info(`Komut alındı: Özel komut - ${data.command}`);

      // Güvenlik kontrolü - sadece izin verilen komutlar
      const allowedCommands = ['dir', 'ipconfig', 'systeminfo'];
      const cmd = data.command.split(' ')[0].toLowerCase();

      if (!allowedCommands.includes(cmd)) {
        callback({ success: false, error: 'Bu komuta izin verilmiyor' });
        return;
      }

      const { exec } = require('child_process');
      exec(data.command, (error, stdout, stderr) => {
        if (error) {
          callback({ success: false, error: error.message });
        } else {
          callback({ success: true, output: stdout, stderr: stderr });
        }
      });
    });
  }

  // Düzenli metrik gönderimi başlat
  startMetricsReporting() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(async () => {
      if (this.connected) {
        try {
          const [metrics, appStatus, wppStatus] = await Promise.all([
            monitor.getSystemMetrics(),
            processManager.getAppStatus(),
            wppConnect.getStatus()
          ]);

          this.socket.emit('agent:metrics', {
            agentId: config.agent.id,
            timestamp: new Date().toISOString(),
            system: metrics,
            app: appStatus,
            wpp: wppStatus
          });

        } catch (error) {
          logger.error('Metrik gönderme hatası:', error);
        }
      }
    }, config.monitor.interval);

    logger.info(`Metrik gönderimi başladı (her ${config.monitor.interval}ms)`);
  }

  // Metrik gönderimini durdur
  stopMetricsReporting() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  // Bağlantıyı kapat
  disconnect() {
    this.stopMetricsReporting();
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Bağlantı durumu
  isConnected() {
    return this.connected;
  }
}

module.exports = new SocketClient();
