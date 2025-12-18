require('dotenv').config();

const config = require('./config/default');
const logger = require('./services/logger');
const socketClient = require('./services/socket-client');
const monitor = require('./services/monitor');
const processManager = require('./services/process');
const wppConnect = require('./services/wppconnect');
const updater = require('./services/updater');

// Log klasörünü oluştur
const fs = require('fs');
const path = require('path');
if (!fs.existsSync(config.log.path)) {
  fs.mkdirSync(config.log.path, { recursive: true });
}

logger.info('='.repeat(50));
logger.info(`Server Manager Agent v1.0.0`);
logger.info(`Agent ID: ${config.agent.id}`);
logger.info(`Agent Name: ${config.agent.name}`);
logger.info('='.repeat(50));

// Başlangıç kontrolü
async function startup() {
  try {
    // Sistem bilgilerini al
    logger.info('Sistem bilgileri alınıyor...');
    const metrics = await monitor.getSystemMetrics();
    logger.info(`OS: ${metrics.os.distro}`);
    logger.info(`Hostname: ${metrics.os.hostname}`);
    logger.info(`CPU: ${metrics.cpu.cores} çekirdek`);
    logger.info(`RAM: ${metrics.memory.total}`);

    // Uygulama durumunu kontrol et
    logger.info('Uygulama durumu kontrol ediliyor...');
    const appStatus = await processManager.getAppStatus();
    logger.info(`${config.app.name}: ${appStatus.running ? 'Çalışıyor' : 'Çalışmıyor'}`);

    // WPP Connect durumunu kontrol et
    logger.info('WPP Connect durumu kontrol ediliyor...');
    const wppStatus = await wppConnect.getStatus();
    logger.info(`WPP Connect: ${wppStatus.overall}`);

    // Merkez sunucuya bağlan
    logger.info('Merkez sunucuya bağlanılıyor...');
    socketClient.connect();

    // Eski yedekleri temizle (başlangıçta)
    await updater.cleanupOldBackups(7);

  } catch (error) {
    logger.error('Başlangıç hatası:', error);
  }
}

// Graceful shutdown
function shutdown(signal) {
  logger.info(`${signal} sinyali alındı, kapatılıyor...`);

  socketClient.disconnect();

  setTimeout(() => {
    logger.info('Agent kapatıldı');
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Beklenmeyen hatalar
process.on('uncaughtException', (error) => {
  logger.error('Beklenmeyen hata:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('İşlenmemiş Promise reddi:', reason);
});

// Başlat
startup();
