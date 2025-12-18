const axios = require('axios');
const { exec, spawn } = require('child_process');
const config = require('../config/default');
const logger = require('./logger');
const monitor = require('./monitor');

class WPPConnectManager {
  constructor() {
    this.lastStatus = null;
    this.healthCheckTimeout = 5000; // 5 saniye timeout
  }

  // WPP Connect durumunu kontrol et
  async getStatus() {
    try {
      // HTTP health check dene
      const httpStatus = await this.checkHttpHealth();

      // Process kontrolü
      const processStatus = await this.checkProcess();

      const status = {
        timestamp: new Date().toISOString(),
        httpHealthy: httpStatus.healthy,
        httpResponse: httpStatus.response,
        processRunning: processStatus.running,
        processPids: processStatus.pids,
        processCpu: processStatus.cpu,
        processMemory: processStatus.memory,
        overall: httpStatus.healthy && processStatus.running ? 'active' : 'inactive'
      };

      this.lastStatus = status;
      return status;

    } catch (error) {
      logger.error('WPP Connect durum kontrolü hatası:', error);
      return {
        timestamp: new Date().toISOString(),
        httpHealthy: false,
        processRunning: false,
        overall: 'error',
        error: error.message
      };
    }
  }

  // HTTP health endpoint kontrolü
  async checkHttpHealth() {
    try {
      const response = await axios.get(config.wppConnect.healthUrl, {
        timeout: this.healthCheckTimeout
      });

      return {
        healthy: true,
        response: response.data,
        statusCode: response.status
      };

    } catch (error) {
      // Bağlantı hatası veya timeout
      return {
        healthy: false,
        error: error.message,
        statusCode: error.response?.status || null
      };
    }
  }

  // WPP Connect process kontrolü
  async checkProcess() {
    const processName = config.wppConnect.processName;
    const metrics = await monitor.getProcessMetrics(processName);

    // WPP Connect genellikle node process'i olarak çalışır
    // Birden fazla node process'i olabilir, WPP ile ilgili olanı bulmaya çalış
    return {
      running: metrics.found && metrics.count > 0,
      pids: metrics.pids || [],
      cpu: metrics.cpu || 0,
      memory: metrics.memory || 0,
      details: metrics.details || []
    };
  }

  // WPP Connect'i yeniden başlat
  async restart() {
    logger.info('WPP Connect yeniden başlatılıyor');

    try {
      // Önce durdur
      await this.stop();

      // 3 saniye bekle
      await this.sleep(3000);

      // Başlat
      return await this.start();

    } catch (error) {
      logger.error('WPP Connect yeniden başlatma hatası:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // WPP Connect'i başlat
  async start() {
    // WPP Connect başlatma komutu - bu sizin kurulumunuza göre değişebilir
    // Genellikle npm start veya node ile başlatılır
    const wppPath = process.env.WPP_PATH || 'C:\\wpp-connect';
    const wppCommand = process.env.WPP_START_COMMAND || 'npm start';

    logger.info(`WPP Connect başlatılıyor: ${wppPath}`);

    return new Promise((resolve, reject) => {
      // PowerShell ile başlat (arka planda çalışsın)
      const command = `Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd ${wppPath} && ${wppCommand}" -WindowStyle Hidden`;

      exec(`powershell -Command "${command}"`, (error, stdout, stderr) => {
        if (error) {
          logger.error('WPP Connect başlatılamadı:', error);
          resolve({
            success: false,
            message: error.message
          });
        } else {
          logger.info('WPP Connect başlatma komutu gönderildi');
          resolve({
            success: true,
            message: 'WPP Connect başlatılıyor'
          });
        }
      });
    });
  }

  // WPP Connect'i durdur
  async stop() {
    const processName = config.wppConnect.processName;

    logger.info('WPP Connect durduruluyor');

    // WPP Connect API üzerinden kapatmayı dene
    try {
      await axios.post(`${config.wppConnect.healthUrl.replace('/status', '/close')}`, {}, {
        timeout: 5000
      });
    } catch (error) {
      // API kapalı olabilir, devam et
    }

    // Process'leri bul ve kapat
    const status = await this.checkProcess();

    if (status.running) {
      for (const pid of status.pids) {
        await this.killProcess(pid);
      }
    }

    return {
      success: true,
      message: 'WPP Connect durduruldu'
    };
  }

  // Process'i öldür
  killProcess(pid) {
    return new Promise((resolve) => {
      exec(`taskkill /F /PID ${pid}`, (error) => {
        resolve();
      });
    });
  }

  // Yardımcı sleep fonksiyonu
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Son durumu döndür (cache)
  getLastStatus() {
    return this.lastStatus;
  }
}

module.exports = new WPPConnectManager();
