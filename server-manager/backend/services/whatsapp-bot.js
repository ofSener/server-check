const wppconnect = require('@wppconnect-team/wppconnect');
const logger = require('./logger');

class WhatsAppBot {
  constructor() {
    this.client = null;
    this.agentManager = null;
    this.adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || '').split(',').filter(n => n);
    this.sessionName = process.env.WPP_SESSION_NAME || 'server-manager';
  }

  // WhatsApp'ı başlat
  async initialize(agentManager) {
    this.agentManager = agentManager;

    try {
      logger.info('WhatsApp Bot başlatılıyor...');

      this.client = await wppconnect.create({
        session: this.sessionName,
        catchQR: (base64Qr, asciiQR) => {
          logger.info('WhatsApp QR Kodu:');
          console.log(asciiQR);
          // QR kodu dosyaya kaydet
          const fs = require('fs');
          const qrData = base64Qr.replace('data:image/png;base64,', '');
          fs.writeFileSync('whatsapp-qr.png', qrData, 'base64');
          logger.info('QR kodu whatsapp-qr.png dosyasına kaydedildi');
        },
        statusFind: (statusSession, session) => {
          logger.info(`WhatsApp durumu: ${statusSession}`);
        },
        headless: true,
        useChrome: true,
        puppeteerOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      logger.info('WhatsApp Bot bağlandı!');

      // Mesaj dinle
      this.client.onMessage((message) => this.handleMessage(message));

      // Sunucu olaylarını dinle
      this.setupServerEventListeners();

      return true;

    } catch (error) {
      logger.error('WhatsApp Bot başlatılamadı:', error);
      return false;
    }
  }

  // Sunucu olaylarını dinle ve bildirim gönder
  setupServerEventListeners() {
    // Sunucu offline olduğunda
    this.agentManager.on('server:offline', async (data) => {
      await this.sendAdminNotification(
        `⚠️ *SUNUCU OFFLINE*\n\n` +
        `Sunucu: ${data.name}\n` +
        `ID: ${data.id}\n` +
        `Zaman: ${data.timestamp}`
      );
    });

    // Sunucu online olduğunda
    this.agentManager.on('server:online', async (data) => {
      await this.sendAdminNotification(
        `✅ *SUNUCU ONLINE*\n\n` +
        `Sunucu: ${data.name}\n` +
        `ID: ${data.id}\n` +
        `Zaman: ${data.timestamp}`
      );
    });
  }

  // Gelen mesajı işle
  async handleMessage(message) {
    // Sadece admin numaralarından gelen mesajları işle
    const senderNumber = message.from.replace('@c.us', '');

    if (!this.adminNumbers.includes(senderNumber)) {
      logger.warn(`Yetkisiz mesaj: ${senderNumber}`);
      return;
    }

    const text = message.body.toLowerCase().trim();
    logger.info(`Komut alındı: ${text} (${senderNumber})`);

    try {
      // Komutları işle
      if (text === 'durum' || text === 'status') {
        await this.handleStatusCommand(message);
      }
      else if (text === 'liste' || text === 'list') {
        await this.handleListCommand(message);
      }
      else if (text.startsWith('başlat ') || text.startsWith('start ')) {
        const serverId = text.split(' ')[1];
        await this.handleStartCommand(message, serverId);
      }
      else if (text.startsWith('durdur ') || text.startsWith('stop ')) {
        const serverId = text.split(' ')[1];
        await this.handleStopCommand(message, serverId);
      }
      else if (text.startsWith('yeniden ') || text.startsWith('restart ')) {
        const serverId = text.split(' ')[1];
        await this.handleRestartCommand(message, serverId);
      }
      else if (text.startsWith('wpp ')) {
        const serverId = text.split(' ')[1];
        await this.handleWppRestartCommand(message, serverId);
      }
      else if (text === 'yardım' || text === 'help') {
        await this.handleHelpCommand(message);
      }
      else {
        await this.sendReply(message,
          '❓ Bilinmeyen komut.\n\n' +
          'Komut listesi için *yardım* yazın.'
        );
      }

    } catch (error) {
      logger.error('Komut işleme hatası:', error);
      await this.sendReply(message, `❌ Hata: ${error.message}`);
    }
  }

  // Durum komutu
  async handleStatusCommand(message) {
    const servers = this.agentManager.getAllServers();
    const online = servers.filter(s => s.status === 'online').length;
    const offline = servers.filter(s => s.status === 'offline').length;

    let statusText = `📊 *SUNUCU DURUMU*\n\n`;
    statusText += `Toplam: ${servers.length}\n`;
    statusText += `Online: ${online} ✅\n`;
    statusText += `Offline: ${offline} ❌\n\n`;

    // Her sunucunun kısa durumu
    for (const server of servers) {
      const statusIcon = server.status === 'online' ? '✅' : '❌';
      const appIcon = server.metrics?.app?.running ? '🟢' : '🔴';
      const wppIcon = server.metrics?.wpp?.overall === 'active' ? '💬' : '⚪';

      statusText += `${statusIcon} *${server.name}* ${appIcon}${wppIcon}\n`;

      if (server.metrics?.system) {
        statusText += `   CPU: ${server.metrics.system.cpu?.usage || 0}% | RAM: ${server.metrics.system.memory?.usagePercent || 0}%\n`;
      }
    }

    await this.sendReply(message, statusText);
  }

  // Liste komutu
  async handleListCommand(message) {
    const servers = this.agentManager.getAllServers();

    let listText = `📋 *SUNUCU LİSTESİ*\n\n`;

    for (const server of servers) {
      const statusIcon = server.status === 'online' ? '✅' : '❌';
      listText += `${statusIcon} ${server.id} - ${server.name}\n`;
    }

    listText += `\n💡 Detay için: *durum*`;

    await this.sendReply(message, listText);
  }

  // Uygulamayı başlat
  async handleStartCommand(message, serverId) {
    await this.sendReply(message, `⏳ ${serverId} - Uygulama başlatılıyor...`);

    const result = await this.agentManager.sendCommand(serverId, 'startApp');

    if (result.success) {
      await this.sendReply(message, `✅ ${serverId} - Uygulama başlatıldı!`);
    } else {
      await this.sendReply(message, `❌ ${serverId} - Hata: ${result.message || result.error}`);
    }
  }

  // Uygulamayı durdur
  async handleStopCommand(message, serverId) {
    await this.sendReply(message, `⏳ ${serverId} - Uygulama durduruluyor...`);

    const result = await this.agentManager.sendCommand(serverId, 'stopApp');

    if (result.success) {
      await this.sendReply(message, `✅ ${serverId} - Uygulama durduruldu!`);
    } else {
      await this.sendReply(message, `❌ ${serverId} - Hata: ${result.message || result.error}`);
    }
  }

  // Uygulamayı yeniden başlat
  async handleRestartCommand(message, serverId) {
    await this.sendReply(message, `⏳ ${serverId} - Uygulama yeniden başlatılıyor...`);

    const result = await this.agentManager.sendCommand(serverId, 'restartApp');

    if (result.success) {
      await this.sendReply(message, `✅ ${serverId} - Uygulama yeniden başlatıldı!`);
    } else {
      await this.sendReply(message, `❌ ${serverId} - Hata: ${result.message || result.error}`);
    }
  }

  // WPP Connect yeniden başlat
  async handleWppRestartCommand(message, serverId) {
    await this.sendReply(message, `⏳ ${serverId} - WPP Connect yeniden başlatılıyor...`);

    const result = await this.agentManager.sendCommand(serverId, 'restartWpp');

    if (result.success) {
      await this.sendReply(message, `✅ ${serverId} - WPP Connect yeniden başlatıldı!`);
    } else {
      await this.sendReply(message, `❌ ${serverId} - Hata: ${result.message || result.error}`);
    }
  }

  // Yardım komutu
  async handleHelpCommand(message) {
    const helpText = `📖 *KOMUTLAR*\n\n` +
      `*durum* - Tüm sunucu durumları\n` +
      `*liste* - Sunucu listesi\n` +
      `*başlat [id]* - Uygulamayı başlat\n` +
      `*durdur [id]* - Uygulamayı durdur\n` +
      `*yeniden [id]* - Uygulamayı yeniden başlat\n` +
      `*wpp [id]* - WPP Connect yeniden başlat\n` +
      `*yardım* - Bu mesaj\n\n` +
      `💡 Örnek: *başlat server-01*`;

    await this.sendReply(message, helpText);
  }

  // Mesaj yanıtla
  async sendReply(message, text) {
    try {
      await this.client.sendText(message.from, text);
    } catch (error) {
      logger.error('Mesaj gönderilemedi:', error);
    }
  }

  // Admin'lere bildirim gönder
  async sendAdminNotification(text) {
    for (const number of this.adminNumbers) {
      try {
        await this.client.sendText(`${number}@c.us`, text);
      } catch (error) {
        logger.error(`Bildirim gönderilemedi (${number}):`, error);
      }
    }
  }

  // Belirli bir numaraya mesaj gönder
  async sendMessage(number, text) {
    try {
      const formattedNumber = number.includes('@c.us') ? number : `${number}@c.us`;
      await this.client.sendText(formattedNumber, text);
      return true;
    } catch (error) {
      logger.error('Mesaj gönderilemedi:', error);
      return false;
    }
  }
}

module.exports = new WhatsAppBot();
