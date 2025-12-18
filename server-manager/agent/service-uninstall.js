const Service = require('node-windows').Service;
const path = require('path');

// Service oluştur
const svc = new Service({
  name: 'ServerManagerAgent',
  script: path.join(__dirname, 'index.js')
});

// Kaldırma tamamlandığında
svc.on('uninstall', function() {
  console.log('Servis başarıyla kaldırıldı!');
});

// Hata durumunda
svc.on('error', function(err) {
  console.error('Servis hatası:', err);
});

// Kaldırma işlemini başlat
console.log('Server Manager Agent servisi kaldırılıyor...');
console.log('');

svc.uninstall();
