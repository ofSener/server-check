module.exports = {
  // Merkez sunucu bağlantısı
  server: {
    url: process.env.SERVER_URL || 'http://localhost:3000',
    reconnectInterval: 5000,  // 5 saniye
  },

  // Bu agent'ın kimliği
  agent: {
    id: process.env.AGENT_ID || 'server-01',
    name: process.env.AGENT_NAME || 'Server 01',
    secret: process.env.AGENT_SECRET || 'change-this-secret',
  },

  // İzleme ayarları
  monitor: {
    interval: 5000,  // Her 5 saniyede bir metrik gönder
  },

  // Yönetilecek .NET uygulaması
  app: {
    name: process.env.APP_NAME || 'MyApp',
    path: process.env.APP_PATH || 'C:\\Program Files\\MyApp\\MyApp.exe',
    workingDir: process.env.APP_WORKING_DIR || 'C:\\Program Files\\MyApp',
  },

  // WPP Connect ayarları
  wppConnect: {
    healthUrl: process.env.WPP_HEALTH_URL || 'http://localhost:21465/api/status',
    processName: process.env.WPP_PROCESS_NAME || 'node',
  },

  // Log ayarları
  log: {
    level: process.env.LOG_LEVEL || 'info',
    path: process.env.LOG_PATH || './logs',
  }
};
