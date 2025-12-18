const { spawn, exec } = require('child_process');
const path = require('path');
const config = require('../config/default');
const logger = require('./logger');
const monitor = require('./monitor');

class ProcessManager {
  constructor() {
    this.managedProcesses = new Map();
  }

  // .NET uygulamasını başlat
  async startApp() {
    const appPath = config.app.path;
    const appName = config.app.name;
    const workingDir = config.app.workingDir;

    try {
      // Önce çalışıyor mu kontrol et
      const status = await this.getAppStatus();
      if (status.running) {
        logger.warn(`${appName} zaten çalışıyor (PID: ${status.pids.join(', ')})`);
        return {
          success: false,
          message: 'Uygulama zaten çalışıyor',
          pids: status.pids
        };
      }

      // Uygulamayı başlat
      logger.info(`${appName} başlatılıyor: ${appPath}`);

      const child = spawn(appPath, [], {
        cwd: workingDir,
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      child.unref();

      // Başlamasını bekle ve kontrol et
      await this.sleep(2000);
      const newStatus = await this.getAppStatus();

      if (newStatus.running) {
        logger.info(`${appName} başarıyla başlatıldı (PID: ${newStatus.pids.join(', ')})`);
        return {
          success: true,
          message: 'Uygulama başlatıldı',
          pids: newStatus.pids
        };
      } else {
        logger.error(`${appName} başlatılamadı`);
        return {
          success: false,
          message: 'Uygulama başlatılamadı'
        };
      }

    } catch (error) {
      logger.error(`${appName} başlatma hatası:`, error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // .NET uygulamasını durdur
  async stopApp() {
    const appName = config.app.name;

    try {
      const status = await this.getAppStatus();
      if (!status.running) {
        logger.warn(`${appName} zaten çalışmıyor`);
        return {
          success: true,
          message: 'Uygulama zaten durdurulmuş'
        };
      }

      logger.info(`${appName} durduruluyor (PID: ${status.pids.join(', ')})`);

      // Her process'i durdur
      for (const pid of status.pids) {
        await this.killProcess(pid);
      }

      // Durduğunu kontrol et
      await this.sleep(2000);
      const newStatus = await this.getAppStatus();

      if (!newStatus.running) {
        logger.info(`${appName} başarıyla durduruldu`);
        return {
          success: true,
          message: 'Uygulama durduruldu'
        };
      } else {
        // Zorla durdur
        logger.warn(`${appName} normal şekilde kapanmadı, zorla kapatılıyor`);
        for (const pid of newStatus.pids) {
          await this.killProcess(pid, true);
        }
        return {
          success: true,
          message: 'Uygulama zorla durduruldu'
        };
      }

    } catch (error) {
      logger.error(`${appName} durdurma hatası:`, error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // .NET uygulamasını yeniden başlat
  async restartApp() {
    const appName = config.app.name;
    logger.info(`${appName} yeniden başlatılıyor`);

    const stopResult = await this.stopApp();
    if (!stopResult.success && stopResult.message !== 'Uygulama zaten durdurulmuş') {
      return stopResult;
    }

    await this.sleep(1000);
    return await this.startApp();
  }

  // Uygulama durumunu al
  async getAppStatus() {
    const appName = config.app.name;
    const metrics = await monitor.getProcessMetrics(appName);

    return {
      running: metrics.found && metrics.count > 0,
      pids: metrics.pids || [],
      cpu: metrics.cpu || 0,
      memory: metrics.memory || 0,
      details: metrics.details || []
    };
  }

  // Process'i öldür
  killProcess(pid, force = false) {
    return new Promise((resolve, reject) => {
      const command = force
        ? `taskkill /F /PID ${pid}`
        : `taskkill /PID ${pid}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Process zaten kapanmış olabilir
          if (error.message.includes('not found')) {
            resolve();
          } else {
            reject(error);
          }
        } else {
          resolve();
        }
      });
    });
  }

  // Herhangi bir process'i isimle durdur
  async killByName(processName, force = false) {
    return new Promise((resolve, reject) => {
      const command = force
        ? `taskkill /F /IM "${processName}"`
        : `taskkill /IM "${processName}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ success: true, message: stdout });
        }
      });
    });
  }

  // Yardımcı sleep fonksiyonu
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ProcessManager();
