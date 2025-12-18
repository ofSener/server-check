const si = require('systeminformation');
const config = require('../config/default');
const logger = require('./logger');

class SystemMonitor {
  constructor() {
    this.lastMetrics = null;
  }

  // Tüm sistem metriklerini al
  async getSystemMetrics() {
    try {
      const [cpu, mem, disk, osInfo, processes] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.processes()
      ]);

      const metrics = {
        timestamp: new Date().toISOString(),
        cpu: {
          usage: Math.round(cpu.currentLoad * 100) / 100,
          cores: cpu.cpus.length,
          perCore: cpu.cpus.map(c => Math.round(c.load * 100) / 100)
        },
        memory: {
          total: this.formatBytes(mem.total),
          used: this.formatBytes(mem.used),
          free: this.formatBytes(mem.free),
          usagePercent: Math.round((mem.used / mem.total) * 100)
        },
        disk: disk.map(d => ({
          mount: d.mount,
          size: this.formatBytes(d.size),
          used: this.formatBytes(d.used),
          available: this.formatBytes(d.available),
          usagePercent: Math.round(d.use)
        })),
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          hostname: osInfo.hostname
        },
        processes: {
          total: processes.all,
          running: processes.running,
          blocked: processes.blocked
        }
      };

      this.lastMetrics = metrics;
      return metrics;

    } catch (error) {
      logger.error('Sistem metrikleri alınamadı:', error);
      throw error;
    }
  }

  // Belirli bir process'in kaynak kullanımını al
  async getProcessMetrics(processName) {
    try {
      const processes = await si.processes();
      const targetProcesses = processes.list.filter(p =>
        p.name.toLowerCase().includes(processName.toLowerCase())
      );

      if (targetProcesses.length === 0) {
        return {
          found: false,
          processName: processName,
          message: 'Process bulunamadı'
        };
      }

      // Aynı isimde birden fazla process olabilir, toplam al
      const totalCpu = targetProcesses.reduce((sum, p) => sum + p.cpu, 0);
      const totalMem = targetProcesses.reduce((sum, p) => sum + p.mem, 0);

      return {
        found: true,
        processName: processName,
        count: targetProcesses.length,
        pids: targetProcesses.map(p => p.pid),
        cpu: Math.round(totalCpu * 100) / 100,
        memory: Math.round(totalMem * 100) / 100,
        details: targetProcesses.map(p => ({
          pid: p.pid,
          name: p.name,
          cpu: Math.round(p.cpu * 100) / 100,
          memory: Math.round(p.mem * 100) / 100,
          state: p.state
        }))
      };

    } catch (error) {
      logger.error('Process metrikleri alınamadı:', error);
      throw error;
    }
  }

  // .NET uygulamasının metriklerini al
  async getAppMetrics() {
    const appName = config.app.name;
    return await this.getProcessMetrics(appName);
  }

  // Byte'ı okunabilir formata çevir
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Son metrikleri döndür (cache)
  getLastMetrics() {
    return this.lastMetrics;
  }
}

module.exports = new SystemMonitor();
