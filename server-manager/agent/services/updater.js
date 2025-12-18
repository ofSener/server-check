const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('../config/default');
const logger = require('./logger');
const processManager = require('./process');

class Updater {
  constructor() {
    this.updateInProgress = false;
    this.backupDir = path.join(config.app.workingDir, 'backup');
  }

  // Güncelleme yap
  async update(options = {}) {
    if (this.updateInProgress) {
      return {
        success: false,
        message: 'Güncelleme zaten devam ediyor'
      };
    }

    this.updateInProgress = true;

    try {
      const { downloadUrl, version, restartAfter = true } = options;

      if (!downloadUrl) {
        throw new Error('İndirme URL\'si belirtilmedi');
      }

      logger.info(`Güncelleme başlatılıyor: v${version || 'unknown'}`);

      // 1. Uygulamayı durdur
      logger.info('Uygulama durduruluyor...');
      await processManager.stopApp();

      // 2. Yedek al
      logger.info('Yedek alınıyor...');
      await this.createBackup();

      // 3. Yeni versiyonu indir
      logger.info('Yeni versiyon indiriliyor...');
      await this.downloadUpdate(downloadUrl);

      // 4. Güncellemeyi uygula
      logger.info('Güncelleme uygulanıyor...');
      await this.applyUpdate();

      // 5. Uygulamayı başlat
      if (restartAfter) {
        logger.info('Uygulama başlatılıyor...');
        await processManager.startApp();
      }

      logger.info('Güncelleme başarılı!');
      this.updateInProgress = false;

      return {
        success: true,
        message: `Güncelleme başarılı: v${version || 'unknown'}`,
        version: version
      };

    } catch (error) {
      logger.error('Güncelleme hatası:', error);

      // Hata durumunda yedeği geri yükle
      try {
        logger.info('Yedek geri yükleniyor...');
        await this.restoreBackup();
        await processManager.startApp();
      } catch (restoreError) {
        logger.error('Yedek geri yükleme hatası:', restoreError);
      }

      this.updateInProgress = false;

      return {
        success: false,
        message: error.message
      };
    }
  }

  // Yedek oluştur
  async createBackup() {
    const appDir = config.app.workingDir;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}`);

    // Backup klasörünü oluştur
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      // Robocopy ile kopyala (Windows)
      const command = `robocopy "${appDir}" "${backupPath}" /E /NFL /NDL /NJH /NJS /nc /ns /np`;

      exec(command, (error, stdout, stderr) => {
        // Robocopy 0-7 arası çıkış kodları başarılı sayılır
        if (error && error.code > 7) {
          reject(new Error(`Yedekleme hatası: ${error.message}`));
        } else {
          this.lastBackupPath = backupPath;
          resolve(backupPath);
        }
      });
    });
  }

  // Güncelleme dosyasını indir
  async downloadUpdate(url) {
    const tempDir = path.join(config.app.workingDir, 'temp_update');

    // Temp klasörünü oluştur
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Dosya adını URL'den al
    const fileName = path.basename(url);
    const filePath = path.join(tempDir, fileName);

    // İndir
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 300000 // 5 dakika timeout
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        this.downloadedFile = filePath;
        resolve(filePath);
      });
      writer.on('error', reject);
    });
  }

  // Güncellemeyi uygula
  async applyUpdate() {
    const downloadedFile = this.downloadedFile;
    const appDir = config.app.workingDir;

    if (!downloadedFile || !fs.existsSync(downloadedFile)) {
      throw new Error('İndirilen dosya bulunamadı');
    }

    // Dosya tipine göre işlem yap
    const ext = path.extname(downloadedFile).toLowerCase();

    if (ext === '.zip') {
      // ZIP dosyasını aç
      return new Promise((resolve, reject) => {
        const command = `powershell -Command "Expand-Archive -Path '${downloadedFile}' -DestinationPath '${appDir}' -Force"`;

        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`ZIP açma hatası: ${error.message}`));
          } else {
            // Temp dosyaları temizle
            this.cleanupTemp();
            resolve();
          }
        });
      });

    } else if (ext === '.exe' || ext === '.msi') {
      // Kurulum dosyasını çalıştır
      return new Promise((resolve, reject) => {
        const command = ext === '.msi'
          ? `msiexec /i "${downloadedFile}" /quiet /norestart`
          : `"${downloadedFile}" /S`;

        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Kurulum hatası: ${error.message}`));
          } else {
            this.cleanupTemp();
            resolve();
          }
        });
      });

    } else {
      // Tek dosya kopyala
      const destPath = path.join(appDir, path.basename(downloadedFile));
      fs.copyFileSync(downloadedFile, destPath);
      this.cleanupTemp();
      return Promise.resolve();
    }
  }

  // Yedeği geri yükle
  async restoreBackup() {
    if (!this.lastBackupPath || !fs.existsSync(this.lastBackupPath)) {
      throw new Error('Geri yüklenecek yedek bulunamadı');
    }

    const appDir = config.app.workingDir;

    return new Promise((resolve, reject) => {
      const command = `robocopy "${this.lastBackupPath}" "${appDir}" /E /NFL /NDL /NJH /NJS /nc /ns /np`;

      exec(command, (error, stdout, stderr) => {
        if (error && error.code > 7) {
          reject(new Error(`Geri yükleme hatası: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  // Temp dosyaları temizle
  cleanupTemp() {
    const tempDir = path.join(config.app.workingDir, 'temp_update');

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // Eski yedekleri temizle (7 günden eski)
  async cleanupOldBackups(daysToKeep = 7) {
    if (!fs.existsSync(this.backupDir)) return;

    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    const backups = fs.readdirSync(this.backupDir);

    for (const backup of backups) {
      const backupPath = path.join(this.backupDir, backup);
      const stats = fs.statSync(backupPath);

      if (now - stats.mtime.getTime() > maxAge) {
        logger.info(`Eski yedek siliniyor: ${backup}`);
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    }
  }
}

module.exports = new Updater();
