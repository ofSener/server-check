#!/usr/bin/env node

const readline = require('readline');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Renkli console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function ask(question) {
  return new Promise(resolve => {
    rl.question(`${colors.cyan}${question}${colors.reset}`, answer => {
      resolve(answer.trim());
    });
  });
}

function askWithDefault(question, defaultVal) {
  return new Promise(resolve => {
    rl.question(`${colors.cyan}${question} ${colors.yellow}[${defaultVal}]${colors.reset}: `, answer => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

async function askChoice(question, choices) {
  console.log(`\n${colors.cyan}${question}${colors.reset}\n`);
  choices.forEach((choice, i) => {
    console.log(`  ${colors.yellow}${i + 1})${colors.reset} ${choice.label}`);
    if (choice.desc) console.log(`     ${colors.bright}${choice.desc}${colors.reset}`);
  });
  console.log();

  const answer = await ask('Seçiminiz (numara): ');
  const index = parseInt(answer) - 1;

  if (index >= 0 && index < choices.length) {
    return choices[index].value;
  }
  return choices[0].value;
}

function runCommand(cmd, cwd = process.cwd()) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function checkNodeInstalled() {
  try {
    execSync('node --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkMongoInstalled() {
  try {
    execSync('mongod --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ==================== ANA SUNUCU KURULUMU ====================

async function setupMainServer() {
  log('\n========================================', 'green');
  log('   ANA SUNUCU KURULUMU (Backend + Dashboard)', 'green');
  log('========================================\n', 'green');

  const config = {};

  // Port
  config.port = await askWithDefault('Backend port numarası', '3000');

  // MongoDB
  log('\nMongoDB Ayarları:', 'yellow');
  const mongoChoice = await askChoice('MongoDB bağlantısı:', [
    { value: 'local', label: 'Yerel MongoDB', desc: 'localhost:27017' },
    { value: 'remote', label: 'Uzak MongoDB', desc: 'MongoDB Atlas veya başka sunucu' },
    { value: 'skip', label: 'MongoDB kullanma', desc: 'Sadece in-memory (veriler kaybolur)' }
  ]);

  if (mongoChoice === 'local') {
    config.mongoUri = 'mongodb://localhost:27017/server-manager';
  } else if (mongoChoice === 'remote') {
    config.mongoUri = await ask('MongoDB URI: ');
  } else {
    config.mongoUri = '';
  }

  // JWT Secret
  config.jwtSecret = generateSecret(32);
  log(`\nJWT Secret otomatik oluşturuldu`, 'green');

  // Agent Secret
  config.agentSecret = await askWithDefault('Agent Secret (tüm agent\'lar bu değeri kullanacak)', generateSecret(16));

  // WhatsApp
  log('\nWhatsApp Bot Ayarları:', 'yellow');
  const enableWhatsapp = await askChoice('WhatsApp bot aktif olsun mu?', [
    { value: true, label: 'Evet', desc: 'Bildirim ve komut alabilirsiniz' },
    { value: false, label: 'Hayır', desc: 'Sadece web dashboard kullanılacak' }
  ]);

  config.whatsappEnabled = enableWhatsapp;

  if (enableWhatsapp) {
    log('\nWhatsApp admin numaralarını girin (ülke kodu ile, virgülle ayırın)', 'bright');
    log('Örnek: 905551234567,905559876543', 'bright');
    config.adminNumbers = await ask('Admin numaraları: ');
  }

  // Dashboard port
  config.dashboardPort = await askWithDefault('Dashboard port numarası', '5173');

  // Özet göster
  log('\n========================================', 'blue');
  log('   KURULUM ÖZETİ', 'blue');
  log('========================================', 'blue');
  log(`Backend Port: ${config.port}`, 'bright');
  log(`Dashboard Port: ${config.dashboardPort}`, 'bright');
  log(`MongoDB: ${config.mongoUri || 'Kullanılmıyor'}`, 'bright');
  log(`Agent Secret: ${config.agentSecret}`, 'bright');
  log(`WhatsApp: ${config.whatsappEnabled ? 'Aktif' : 'Pasif'}`, 'bright');
  if (config.whatsappEnabled) {
    log(`Admin Numaraları: ${config.adminNumbers}`, 'bright');
  }

  const confirm = await ask('\nKuruluma devam edilsin mi? (e/h): ');
  if (confirm.toLowerCase() !== 'e') {
    log('Kurulum iptal edildi.', 'red');
    return;
  }

  // Backend .env oluştur
  log('\n[1/4] Backend .env dosyası oluşturuluyor...', 'yellow');
  const backendEnv = `# Server Manager Backend
PORT=${config.port}
NODE_ENV=production

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:${config.dashboardPort}

# MongoDB
MONGODB_URI=${config.mongoUri}

# Güvenlik
JWT_SECRET=${config.jwtSecret}
AGENT_SECRET=${config.agentSecret}

# WhatsApp Bot
WHATSAPP_ENABLED=${config.whatsappEnabled}
ADMIN_WHATSAPP_NUMBERS=${config.adminNumbers || ''}
WPP_SESSION_NAME=server-manager

# Log
LOG_LEVEL=info
`;

  fs.writeFileSync(path.join(__dirname, 'backend', '.env'), backendEnv);
  log('Backend .env oluşturuldu!', 'green');

  // Backend npm install
  log('\n[2/4] Backend bağımlılıkları yükleniyor...', 'yellow');
  if (!runCommand('npm install', path.join(__dirname, 'backend'))) {
    log('Backend bağımlılıkları yüklenemedi!', 'red');
    return;
  }
  log('Backend bağımlılıkları yüklendi!', 'green');

  // Dashboard npm install
  log('\n[3/4] Dashboard bağımlılıkları yükleniyor...', 'yellow');
  if (!runCommand('npm install', path.join(__dirname, 'dashboard'))) {
    log('Dashboard bağımlılıkları yüklenemedi!', 'red');
    return;
  }
  log('Dashboard bağımlılıkları yüklendi!', 'green');

  // Vite config güncelle
  log('\n[4/4] Dashboard yapılandırılıyor...', 'yellow');
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${config.dashboardPort},
    proxy: {
      '/api': {
        target: 'http://localhost:${config.port}',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:${config.port}',
        ws: true
      }
    }
  }
})
`;
  fs.writeFileSync(path.join(__dirname, 'dashboard', 'vite.config.js'), viteConfig);
  log('Dashboard yapılandırıldı!', 'green');

  // Başlatma scriptleri oluştur
  createStartScripts(config);

  log('\n========================================', 'green');
  log('   KURULUM TAMAMLANDI!', 'green');
  log('========================================\n', 'green');

  log('Başlatmak için:', 'bright');
  log('  1. start-backend.bat   (Backend\'i başlatır)', 'cyan');
  log('  2. start-dashboard.bat (Dashboard\'u başlatır)', 'cyan');
  log('  veya', 'bright');
  log('  start-all.bat          (Her ikisini de başlatır)\n', 'cyan');

  log('Dashboard adresi: http://localhost:' + config.dashboardPort, 'yellow');
  log('Varsayılan giriş: admin / admin123\n', 'yellow');

  log('Agent\'ları kurmak için bu scripti agent kurulacak sunucuya kopyalayın', 'bright');
  log('ve "node setup.js" komutunu çalıştırın.\n', 'bright');

  log(`\n${colors.red}ÖNEMLİ: Agent Secret'ı not edin: ${config.agentSecret}${colors.reset}`, 'red');
  log('Bu değeri agent kurulumlarında kullanacaksınız.\n', 'red');
}

// ==================== AGENT KURULUMU ====================

async function setupAgent() {
  log('\n========================================', 'green');
  log('   AGENT KURULUMU (Yönetilecek Sunucu)', 'green');
  log('========================================\n', 'green');

  const config = {};

  // Server URL
  log('Ana sunucunun adresi (Backend çalışan sunucu)', 'bright');
  config.serverUrl = await ask('Server URL (örn: http://192.168.1.100:3000): ');

  // Agent bilgileri
  log('\nBu sunucunun kimliği:', 'yellow');
  config.agentId = await askWithDefault('Agent ID (benzersiz)', `server-${Date.now().toString(36)}`);
  config.agentName = await askWithDefault('Agent Adı (görünen isim)', config.agentId);

  // Secret
  config.agentSecret = await ask('Agent Secret (ana sunucu kurulumunda verilen): ');

  // Uygulama ayarları
  log('\nYönetilecek .NET Uygulaması:', 'yellow');
  config.appName = await askWithDefault('Uygulama adı', 'MyApp');
  config.appPath = await ask('Uygulama yolu (örn: C:\\MyApp\\app.exe): ');
  config.appWorkingDir = await askWithDefault('Çalışma dizini', path.dirname(config.appPath));

  // WPP Connect ayarları
  log('\nWPP Connect Ayarları:', 'yellow');
  const hasWpp = await askChoice('Bu sunucuda WPP Connect var mı?', [
    { value: true, label: 'Evet' },
    { value: false, label: 'Hayır' }
  ]);

  if (hasWpp) {
    config.wppHealthUrl = await askWithDefault('WPP Health URL', 'http://localhost:21465/api/status');
    config.wppPath = await askWithDefault('WPP Connect dizini', 'C:\\wpp-connect');
  } else {
    config.wppHealthUrl = '';
    config.wppPath = '';
  }

  // Özet
  log('\n========================================', 'blue');
  log('   KURULUM ÖZETİ', 'blue');
  log('========================================', 'blue');
  log(`Server URL: ${config.serverUrl}`, 'bright');
  log(`Agent ID: ${config.agentId}`, 'bright');
  log(`Agent Adı: ${config.agentName}`, 'bright');
  log(`Uygulama: ${config.appPath}`, 'bright');
  log(`WPP Connect: ${hasWpp ? config.wppHealthUrl : 'Yok'}`, 'bright');

  const confirm = await ask('\nKuruluma devam edilsin mi? (e/h): ');
  if (confirm.toLowerCase() !== 'e') {
    log('Kurulum iptal edildi.', 'red');
    return;
  }

  // Agent .env oluştur
  log('\n[1/3] Agent .env dosyası oluşturuluyor...', 'yellow');
  const agentEnv = `# Server Manager Agent
# Bu sunucunun ayarları

# Merkez Sunucu Bağlantısı
SERVER_URL=${config.serverUrl}

# Agent Kimliği
AGENT_ID=${config.agentId}
AGENT_NAME=${config.agentName}
AGENT_SECRET=${config.agentSecret}

# Yönetilecek .NET Uygulaması
APP_NAME=${config.appName}
APP_PATH=${config.appPath}
APP_WORKING_DIR=${config.appWorkingDir}

# WPP Connect Ayarları
WPP_HEALTH_URL=${config.wppHealthUrl}
WPP_PATH=${config.wppPath}
WPP_PROCESS_NAME=node

# Log Ayarları
LOG_LEVEL=info
LOG_PATH=./logs
`;

  fs.writeFileSync(path.join(__dirname, 'agent', '.env'), agentEnv);
  log('Agent .env oluşturuldu!', 'green');

  // npm install
  log('\n[2/3] Agent bağımlılıkları yükleniyor...', 'yellow');
  if (!runCommand('npm install', path.join(__dirname, 'agent'))) {
    log('Agent bağımlılıkları yüklenemedi!', 'red');
    return;
  }
  log('Agent bağımlılıkları yüklendi!', 'green');

  // Başlatma scriptleri
  log('\n[3/3] Başlatma scriptleri oluşturuluyor...', 'yellow');
  createAgentScripts(config);
  log('Scriptler oluşturuldu!', 'green');

  log('\n========================================', 'green');
  log('   KURULUM TAMAMLANDI!', 'green');
  log('========================================\n', 'green');

  // Windows Service kurulumu
  const installService = await askChoice('Windows Service olarak kurmak ister misiniz?', [
    { value: true, label: 'Evet', desc: 'Sunucu açıldığında otomatik başlar (Yönetici gerekli)' },
    { value: false, label: 'Hayır', desc: 'Manuel başlatacağım' }
  ]);

  if (installService) {
    log('\nWindows Service kuruluyor...', 'yellow');
    log('NOT: Bu işlem yönetici hakları gerektirir!\n', 'red');

    if (runCommand('npm run install-service', path.join(__dirname, 'agent'))) {
      log('Windows Service kuruldu ve başlatıldı!', 'green');
    } else {
      log('Service kurulumu başarısız. Manuel kurmak için:', 'red');
      log('  1. Komut istemini yönetici olarak açın', 'yellow');
      log('  2. cd ' + path.join(__dirname, 'agent'), 'yellow');
      log('  3. npm run install-service', 'yellow');
    }
  } else {
    log('\nAgent\'ı manuel başlatmak için:', 'bright');
    log('  start-agent.bat', 'cyan');
    log('veya', 'bright');
    log('  cd agent && npm start', 'cyan');
  }

  log('\nAgent durumunu kontrol etmek için Dashboard\'u açın.', 'bright');
}

// ==================== YARDIMCI FONKSİYONLAR ====================

function generateSecret(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createStartScripts(config) {
  // Backend başlatma
  const backendBat = `@echo off
title Server Manager - Backend
cd /d "%~dp0backend"
echo Starting Backend on port ${config.port}...
npm start
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-backend.bat'), backendBat);

  // Dashboard başlatma
  const dashboardBat = `@echo off
title Server Manager - Dashboard
cd /d "%~dp0dashboard"
echo Starting Dashboard on port ${config.dashboardPort}...
npm run dev
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-dashboard.bat'), dashboardBat);

  // Her ikisini başlat
  const allBat = `@echo off
echo Starting Server Manager...
start "Backend" cmd /c "%~dp0start-backend.bat"
timeout /t 3 /nobreak > nul
start "Dashboard" cmd /c "%~dp0start-dashboard.bat"
echo.
echo Backend: http://localhost:${config.port}
echo Dashboard: http://localhost:${config.dashboardPort}
echo.
echo Varsayilan giris: admin / admin123
`;
  fs.writeFileSync(path.join(__dirname, 'start-all.bat'), allBat);
}

function createAgentScripts(config) {
  const agentBat = `@echo off
title Server Manager Agent - ${config.agentName}
cd /d "%~dp0agent"
echo Starting Agent: ${config.agentName} (${config.agentId})
echo Connecting to: ${config.serverUrl}
npm start
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-agent.bat'), agentBat);
}

// ==================== ANA PROGRAM ====================

async function main() {
  console.clear();
  log('╔════════════════════════════════════════════╗', 'green');
  log('║                                            ║', 'green');
  log('║      SERVER MANAGER KURULUM SIHIRBAZI      ║', 'green');
  log('║                                            ║', 'green');
  log('╚════════════════════════════════════════════╝', 'green');

  // Node.js kontrolü
  if (!checkNodeInstalled()) {
    log('\nHATA: Node.js bulunamadı!', 'red');
    log('Lütfen Node.js kurun: https://nodejs.org', 'yellow');
    rl.close();
    return;
  }

  const choice = await askChoice('Ne kurmak istiyorsunuz?', [
    {
      value: 'main',
      label: 'Ana Sunucu (Backend + Dashboard)',
      desc: 'Merkez yönetim sunucusu - tüm agent\'ları yönetir'
    },
    {
      value: 'agent',
      label: 'Agent (Yönetilecek Sunucu)',
      desc: 'Bu sunucuyu uzaktan yönetmek için agent kur'
    },
    {
      value: 'both',
      label: 'Her İkisi',
      desc: 'Bu sunucu hem merkez hem de yönetilecek olacak'
    }
  ]);

  if (choice === 'main') {
    await setupMainServer();
  } else if (choice === 'agent') {
    await setupAgent();
  } else if (choice === 'both') {
    await setupMainServer();
    log('\n\nŞimdi agent kurulumuna geçiliyor...\n', 'yellow');
    await setupAgent();
  }

  rl.close();
}

main().catch(err => {
  log(`\nHata: ${err.message}`, 'red');
  rl.close();
});
