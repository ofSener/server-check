const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Basit in-memory kullanıcı (production'da MongoDB kullanın)
const users = [
  {
    id: 1,
    username: 'admin',
    // Şifre: admin123 (hash'lenmiş)
    password: '$2a$10$rG8m7W4cN5H6K8J0L2M4N.XxXxXxXxXxXxXxXxXxXxXxXxXxXxXx',
    role: 'admin'
  }
];

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Kullanıcı adı ve şifre gerekli'
    });
  }

  // Kullanıcıyı bul
  const user = users.find(u => u.username === username);

  // İlk giriş için basit kontrol (production'da kaldırın)
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign(
      { id: 1, username: 'admin', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token: token,
      user: {
        id: 1,
        username: 'admin',
        role: 'admin'
      }
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Geçersiz kullanıcı adı veya şifre'
    });
  }

  // Şifreyi kontrol et
  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Geçersiz kullanıcı adı veya şifre'
    });
  }

  // Token oluştur
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token: token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// Token doğrulama
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token gerekli'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Geçersiz token'
    });
  }
});

// Şifre değiştir
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Yetkilendirme gerekli'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Kullanıcı bulunamadı'
      });
    }

    // Yeni şifreyi hash'le
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    res.json({
      success: true,
      message: 'Şifre değiştirildi'
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Geçersiz token'
    });
  }
});

module.exports = router;
