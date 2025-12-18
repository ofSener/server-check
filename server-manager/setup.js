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

  const answer = await ask('Seciminiz (numara): ');
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

function runCommandSilent(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
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

// Yonetici kontrolu
function isAdmin() {
  try {
    execSync('net session', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Firewall port acma (Windows)
function openFirewallPort(port, name) {
  try {
    // Once mevcut kurali sil (varsa)
    try {
      execSync(`netsh advfirewall firewall delete rule name="${name}"`, { stdio: 'pipe' });
    } catch {}

    // Yeni kural ekle (TCP Inbound)
    execSync(
      `netsh advfirewall firewall add rule name="${name}" dir=in action=allow protocol=tcp localport=${port}`,
      { stdio: 'pipe' }
    );
    return true;
  } catch (error) {
    return false;
  }
}

// Secret olustur
function generateSecret(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ==================== ANA SUNUCU KURULUMU ====================

async function setupMainServer() {
  log('\n========================================', 'green');
  log('   ANA SUNUCU KURULUMU (Backend + Dashboard)', 'green');
  log('========================================\n', 'green');

  const config = {};

  // Port
  config.port = await askWithDefault('Backend port numarasi', '3000');

  // MongoDB
  log('\nMongoDB Ayarlari:', 'yellow');
  const mongoChoice = await askChoice('MongoDB baglantisi:', [
    { value: 'local', label: 'Yerel MongoDB', desc: 'localhost:27017' },
    { value: 'remote', label: 'Uzak MongoDB', desc: 'MongoDB Atlas veya baska sunucu' },
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
  log(`\nJWT Secret otomatik olusturuldu`, 'green');

  // Agent Secret
  config.agentSecret = await askWithDefault('Agent Secret (tum agentlar bu degeri kullanacak)', generateSecret(16));

  // WhatsApp
  log('\nWhatsApp Bot Ayarlari:', 'yellow');
  const enableWhatsapp = await askChoice('WhatsApp bot aktif olsun mu?', [
    { value: true, label: 'Evet', desc: 'Bildirim ve komut alabilirsiniz' },
    { value: false, label: 'Hayir', desc: 'Sadece web dashboard kullanilacak' }
  ]);

  config.whatsappEnabled = enableWhatsapp;

  if (enableWhatsapp) {
    log('\nWhatsApp admin numaralarini girin (ulke kodu ile, virgulle ayirin)', 'bright');
    log('Ornek: 905551234567,905559876543', 'bright');
    config.adminNumbers = await ask('Admin numaralari: ');
  }

  // Dashboard port
  config.dashboardPort = await askWithDefault('Dashboard port numarasi', '5173');

  // Firewall
  log('\nFirewall Ayarlari:', 'yellow');
  config.openFirewall = await askChoice('Firewall portlarini otomatik ac?', [
    { value: true, label: 'Evet (Onerilen)', desc: 'Backend ve Dashboard portlari acilir - Yonetici gerekli' },
    { value: false, label: 'Hayir', desc: 'Manuel acacagim' }
  ]);

  // Ozet goster
  log('\n========================================', 'blue');
  log('   KURULUM OZETI', 'blue');
  log('========================================', 'blue');
  log(`Backend Port: ${config.port}`, 'bright');
  log(`Dashboard Port: ${config.dashboardPort}`, 'bright');
  log(`MongoDB: ${config.mongoUri || 'Kullanilmiyor'}`, 'bright');
  log(`Agent Secret: ${config.agentSecret}`, 'bright');
  log(`WhatsApp: ${config.whatsappEnabled ? 'Aktif' : 'Pasif'}`, 'bright');
  log(`Firewall: ${config.openFirewall ? 'Otomatik acilacak' : 'Manuel'}`, 'bright');
  if (config.whatsappEnabled) {
    log(`Admin Numaralari: ${config.adminNumbers}`, 'bright');
  }

  const confirm = await ask('\nKuruluma devam edilsin mi? (e/h): ');
  if (confirm.toLowerCase() !== 'e') {
    log('Kurulum iptal edildi.', 'red');
    return;
  }

  // Backend .env olustur
  log('\n[1/5] Backend .env dosyasi olusturuluyor...', 'yellow');
  const backendEnv = `# Server Manager Backend
PORT=${config.port}
NODE_ENV=production

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:${config.dashboardPort}

# MongoDB
MONGODB_URI=${config.mongoUri}

# Guvenlik
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
  log('Backend .env olusturuldu!', 'green');

  // Backend npm install
  log('\n[2/5] Backend bagimliliklari yukleniyor...', 'yellow');
  if (!runCommand('npm install', path.join(__dirname, 'backend'))) {
    log('Backend bagimliliklari yuklenemedi!', 'red');
    return;
  }
  log('Backend bagimliliklari yuklendi!', 'green');

  // Dashboard npm install
  log('\n[3/5] Dashboard bagimliliklari yukleniyor...', 'yellow');
  if (!runCommand('npm install', path.join(__dirname, 'dashboard'))) {
    log('Dashboard bagimliliklari yuklenemedi!', 'red');
    return;
  }
  log('Dashboard bagimliliklari yuklendi!', 'green');

  // Vite config guncelle
  log('\n[4/5] Dashboard yapilandiriliyor...', 'yellow');
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${config.dashboardPort},
    host: '0.0.0.0',
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
  log('Dashboard yapilandirildi!', 'green');

  // Firewall portlarini ac
  log('\n[5/5] Firewall ayarlari yapiliyor...', 'yellow');
  if (config.openFirewall) {
    if (!isAdmin()) {
      log('UYARI: Yonetici haklari yok! Firewall kurallari eklenemedi.', 'red');
      log('Manuel acmak icin yonetici olarak calistirin:', 'yellow');
      log(`  netsh advfirewall firewall add rule name="ServerManager-Backend" dir=in action=allow protocol=tcp localport=${config.port}`, 'cyan');
      log(`  netsh advfirewall firewall add rule name="ServerManager-Dashboard" dir=in action=allow protocol=tcp localport=${config.dashboardPort}`, 'cyan');
    } else {
      const backendResult = openFirewallPort(config.port, 'ServerManager-Backend');
      const dashboardResult = openFirewallPort(config.dashboardPort, 'ServerManager-Dashboard');

      if (backendResult && dashboardResult) {
        log('Firewall portlari acildi!', 'green');
        log(`  - Port ${config.port} (Backend)`, 'green');
        log(`  - Port ${config.dashboardPort} (Dashboard)`, 'green');
      } else {
        log('Bazi firewall kurallari eklenemedi. Manuel kontrol edin.', 'yellow');
      }
    }
  } else {
    log('Firewall ayarlari atlanildi.', 'yellow');
  }

  // Baslatma scriptleri olustur
  createStartScripts(config);

  log('\n========================================', 'green');
  log('   KURULUM TAMAMLANDI!', 'green');
  log('========================================\n', 'green');

  log('Baslatmak icin:', 'bright');
  log('  1. start-backend.bat   (Backendi baslatir)', 'cyan');
  log('  2. start-dashboard.bat (Dashboardu baslatir)', 'cyan');
  log('  veya', 'bright');
  log('  start-all.bat          (Her ikisini de baslatir)\n', 'cyan');

  log('Dashboard adresi: http://localhost:' + config.dashboardPort, 'yellow');
  log('Varsayilan giris: admin / admin123\n', 'yellow');

  log('Agentlari kurmak icin bu scripti agent kurulacak sunucuya kopyalayin', 'bright');
  log('ve "node setup.js" komutunu calistirin.\n', 'bright');

  log(`\n${colors.red}ONEMLI: Agent Secreti not edin: ${config.agentSecret}${colors.reset}`, 'red');
  log('Bu degeri agent kurulumlarinda kullanacaksiniz.\n', 'red');

  return config;
}

// ==================== AGENT KURULUMU ====================

async function setupAgent() {
  log('\n========================================', 'green');
  log('   AGENT KURULUMU (Yonetilecek Sunucu)', 'green');
  log('========================================\n', 'green');

  const config = {};

  // Server URL
  log('Ana sunucunun adresi (Backend calisan sunucu)', 'bright');
  config.serverUrl = await ask('Server URL (orn: http://192.168.1.100:3000): ');

  // Agent bilgileri
  log('\nBu sunucunun kimligi:', 'yellow');
  config.agentId = await askWithDefault('Agent ID (benzersiz)', `server-${Date.now().toString(36)}`);
  config.agentName = await askWithDefault('Agent Adi (gorunen isim)', config.agentId);

  // Secret
  config.agentSecret = await ask('Agent Secret (ana sunucu kurulumunda verilen): ');

  // Uygulama ayarlari
  log('\nYonetilecek .NET Uygulamasi:', 'yellow');
  config.appName = await askWithDefault('Uygulama adi', 'MyApp');
  config.appPath = await ask('Uygulama yolu (orn: C:\\MyApp\\app.exe): ');
  config.appWorkingDir = await askWithDefault('Calisma dizini', path.dirname(config.appPath || 'C:\\'));

  // WPP Connect ayarlari
  log('\nWPP Connect Ayarlari:', 'yellow');
  const hasWpp = await askChoice('Bu sunucuda WPP Connect var mi?', [
    { value: true, label: 'Evet' },
    { value: false, label: 'Hayir' }
  ]);

  if (hasWpp) {
    config.wppHealthUrl = await askWithDefault('WPP Health URL', 'http://localhost:21465/api/status');
    config.wppPath = await askWithDefault('WPP Connect dizini', 'C:\\wpp-connect');
  } else {
    config.wppHealthUrl = '';
    config.wppPath = '';
  }

  // Firewall (Agent icin gerekmez ama soralim)
  log('\nFirewall Ayarlari:', 'yellow');
  log('NOT: Agent disari port acmaz, sadece merkeze baglanir.', 'bright');
  log('Ama uygulamaniz icin port acmak isterseniz:', 'bright');
  config.openAppFirewall = await askChoice('Uygulama icin firewall portu ac?', [
    { value: false, label: 'Hayir', desc: 'Port acmaya gerek yok' },
    { value: true, label: 'Evet', desc: 'Belirli bir portu ac' }
  ]);

  if (config.openAppFirewall) {
    config.appPort = await ask('Acilacak port numarasi: ');
  }

  // Ozet
  log('\n========================================', 'blue');
  log('   KURULUM OZETI', 'blue');
  log('========================================', 'blue');
  log(`Server URL: ${config.serverUrl}`, 'bright');
  log(`Agent ID: ${config.agentId}`, 'bright');
  log(`Agent Adi: ${config.agentName}`, 'bright');
  log(`Uygulama: ${config.appPath}`, 'bright');
  log(`WPP Connect: ${hasWpp ? config.wppHealthUrl : 'Yok'}`, 'bright');
  if (config.openAppFirewall) {
    log(`Firewall Port: ${config.appPort}`, 'bright');
  }

  const confirm = await ask('\nKuruluma devam edilsin mi? (e/h): ');
  if (confirm.toLowerCase() !== 'e') {
    log('Kurulum iptal edildi.', 'red');
    return;
  }

  // Agent .env olustur
  log('\n[1/4] Agent .env dosyasi olusturuluyor...', 'yellow');
  const agentEnv = `# Server Manager Agent
# Bu sunucunun ayarlari

# Merkez Sunucu Baglantisi
SERVER_URL=${config.serverUrl}

# Agent Kimligi
AGENT_ID=${config.agentId}
AGENT_NAME=${config.agentName}
AGENT_SECRET=${config.agentSecret}

# Yonetilecek .NET Uygulamasi
APP_NAME=${config.appName}
APP_PATH=${config.appPath}
APP_WORKING_DIR=${config.appWorkingDir}

# WPP Connect Ayarlari
WPP_HEALTH_URL=${config.wppHealthUrl}
WPP_PATH=${config.wppPath}
WPP_PROCESS_NAME=node

# Log Ayarlari
LOG_LEVEL=info
LOG_PATH=./logs
`;

  fs.writeFileSync(path.join(__dirname, 'agent', '.env'), agentEnv);
  log('Agent .env olusturuldu!', 'green');

  // npm install
  log('\n[2/4] Agent bagimliliklari yukleniyor...', 'yellow');
  if (!runCommand('npm install', path.join(__dirname, 'agent'))) {
    log('Agent bagimliliklari yuklenemedi!', 'red');
    return;
  }
  log('Agent bagimliliklari yuklendi!', 'green');

  // Baslatma scriptleri
  log('\n[3/4] Baslatma scriptleri olusturuluyor...', 'yellow');
  createAgentScripts(config);
  log('Scriptler olusturuldu!', 'green');

  // Firewall
  log('\n[4/4] Firewall ayarlari yapiliyor...', 'yellow');
  if (config.openAppFirewall && config.appPort) {
    if (!isAdmin()) {
      log('UYARI: Yonetici haklari yok! Firewall kurali eklenemedi.', 'red');
      log('Manuel acmak icin:', 'yellow');
      log(`  netsh advfirewall firewall add rule name="ServerManager-App-${config.agentId}" dir=in action=allow protocol=tcp localport=${config.appPort}`, 'cyan');
    } else {
      if (openFirewallPort(config.appPort, `ServerManager-App-${config.agentId}`)) {
        log(`Firewall portu acildi: ${config.appPort}`, 'green');
      } else {
        log('Firewall kurali eklenemedi.', 'yellow');
      }
    }
  } else {
    log('Firewall ayarlari atlanildi.', 'yellow');
  }

  log('\n========================================', 'green');
  log('   KURULUM TAMAMLANDI!', 'green');
  log('========================================\n', 'green');

  // Windows Service kurulumu
  const installService = await askChoice('Windows Service olarak kurmak ister misiniz?', [
    { value: true, label: 'Evet', desc: 'Sunucu acildiginda otomatik baslar (Yonetici gerekli)' },
    { value: false, label: 'Hayir', desc: 'Manuel baslatacagim' }
  ]);

  if (installService) {
    log('\nWindows Service kuruluyor...', 'yellow');
    log('NOT: Bu islem yonetici haklari gerektirir!\n', 'red');

    if (runCommand('npm run install-service', path.join(__dirname, 'agent'))) {
      log('Windows Service kuruldu ve baslatildi!', 'green');
    } else {
      log('Service kurulumu basarisiz. Manuel kurmak icin:', 'red');
      log('  1. Komut istemini yonetici olarak acin', 'yellow');
      log('  2. cd ' + path.join(__dirname, 'agent'), 'yellow');
      log('  3. npm run install-service', 'yellow');
    }
  } else {
    log('\nAgenti manuel baslatmak icin:', 'bright');
    log('  start-agent.bat', 'cyan');
    log('veya', 'bright');
    log('  cd agent && npm start', 'cyan');
  }

  log('\nAgent durumunu kontrol etmek icin Dashboardu acin.', 'bright');
}

// ==================== YARDIMCI FONKSIYONLAR ====================

function createStartScripts(config) {
  // Backend baslatma
  const backendBat = `@echo off
chcp 65001 > nul
title Server Manager - Backend
cd /d "%~dp0backend"
echo.
echo  ========================================
echo    SERVER MANAGER - BACKEND
echo    Port: ${config.port}
echo  ========================================
echo.
npm start
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-backend.bat'), backendBat);

  // Dashboard baslatma
  const dashboardBat = `@echo off
chcp 65001 > nul
title Server Manager - Dashboard
cd /d "%~dp0dashboard"
echo.
echo  ========================================
echo    SERVER MANAGER - DASHBOARD
echo    Port: ${config.dashboardPort}
echo  ========================================
echo.
npm run dev
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-dashboard.bat'), dashboardBat);

  // Her ikisini baslat
  const allBat = `@echo off
chcp 65001 > nul
echo.
echo  ========================================
echo    SERVER MANAGER BASLATILIYOR
echo  ========================================
echo.
start "Backend" cmd /c "%~dp0start-backend.bat"
timeout /t 3 /nobreak > nul
start "Dashboard" cmd /c "%~dp0start-dashboard.bat"
echo.
echo  Backend:   http://localhost:${config.port}
echo  Dashboard: http://localhost:${config.dashboardPort}
echo.
echo  Varsayilan giris: admin / admin123
echo.
echo  Bu pencereyi kapatabilirsiniz.
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-all.bat'), allBat);
}

function createAgentScripts(config) {
  const agentBat = `@echo off
chcp 65001 > nul
title Server Manager Agent - ${config.agentName}
cd /d "%~dp0agent"
echo.
echo  ========================================
echo    SERVER MANAGER AGENT
echo    ID: ${config.agentId}
echo    Name: ${config.agentName}
echo    Server: ${config.serverUrl}
echo  ========================================
echo.
npm start
pause
`;
  fs.writeFileSync(path.join(__dirname, 'start-agent.bat'), agentBat);
}

// ==================== ANA PROGRAM ====================

async function main() {
  console.clear();
  log('', 'green');
  log('  ╔════════════════════════════════════════════╗', 'green');
  log('  ║                                            ║', 'green');
  log('  ║      SERVER MANAGER KURULUM SIHIRBAZI      ║', 'green');
  log('  ║                                            ║', 'green');
  log('  ╚════════════════════════════════════════════╝', 'green');

  // Node.js kontrolu
  if (!checkNodeInstalled()) {
    log('\nHATA: Node.js bulunamadi!', 'red');
    log('Lutfen Node.js kurun: https://nodejs.org', 'yellow');
    rl.close();
    return;
  }

  // Yonetici kontrolu
  if (isAdmin()) {
    log('\n[OK] Yonetici olarak calistiriliyor', 'green');
  } else {
    log('\n[!] Normal kullanici olarak calistiriliyor', 'yellow');
    log('    Firewall ve Service islemleri icin yonetici gerekli', 'yellow');
  }

  const choice = await askChoice('Ne kurmak istiyorsunuz?', [
    {
      value: 'main',
      label: 'Ana Sunucu (Backend + Dashboard)',
      desc: 'Merkez yonetim sunucusu - tum agentlari yonetir'
    },
    {
      value: 'agent',
      label: 'Agent (Yonetilecek Sunucu)',
      desc: 'Bu sunucuyu uzaktan yonetmek icin agent kur'
    },
    {
      value: 'both',
      label: 'Her Ikisi',
      desc: 'Bu sunucu hem merkez hem de yonetilecek olacak'
    }
  ]);

  if (choice === 'main') {
    await setupMainServer();
  } else if (choice === 'agent') {
    await setupAgent();
  } else if (choice === 'both') {
    const mainConfig = await setupMainServer();
    log('\n\nSimdi agent kurulumuna geciliyor...\n', 'yellow');
    await setupAgent();
  }

  rl.close();
}

main().catch(err => {
  log(`\nHata: ${err.message}`, 'red');
  rl.close();
});
