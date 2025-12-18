const Service = require('node-windows').Service;
const path = require('path');

// Service oluştur
const svc = new Service({
  name: 'ServerManagerAgent',
  description: 'Server Manager Agent - Sunucu yönetim hizmeti',
  script: path.join(__dirname, 'index.js'),
  nodeOptions: [],
  env: [{
    name: 'NODE_ENV',
    value: 'production'
  }]
});

// Kurulum tamamlandığında
svc.on('install', function() {
  console.log('Servis kuruldu!');
  console.log('Servis başlatılıyor...');
  svc.start();
});

// Başlatıldığında
svc.on('start', function() {
  console.log('Servis başlatıldı!');
  console.log('');
  console.log('Servis durumunu kontrol etmek için:');
  console.log('  sc query ServerManagerAgent');
  console.log('');
  console.log('Servisi durdurmak için:');
  console.log('  sc stop ServerManagerAgent');
  console.log('');
  console.log('Servisi kaldırmak için:');
  console.log('  npm run uninstall-service');
});

// Hata durumunda
svc.on('error', function(err) {
  console.error('Servis hatası:', err);
});

svc.on('invalidinstallation', function() {
  console.error('Geçersiz kurulum!');
});

svc.on('alreadyinstalled', function() {
  console.log('Servis zaten kurulu!');
  console.log('Önce kaldırın: npm run uninstall-service');
});

// Kurulumu başlat
console.log('Server Manager Agent servisi kuruluyor...');
console.log('Bu işlem yönetici hakları gerektirir.');
console.log('');

svc.install();
