require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const logger = require('./services/logger');

// Express app oluştur
const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const serversRouter = require('./routes/servers');
const commandsRouter = require('./routes/commands');
const metricsRouter = require('./routes/metrics');
const authRouter = require('./routes/auth');

app.use('/api/servers', serversRouter);
app.use('/api/commands', commandsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/auth', authRouter);

// Agent yönetimi
const AgentManager = require('./services/agent-manager');
const agentManager = new AgentManager(io);

// Socket.IO bağlantıları
io.on('connection', (socket) => {
  logger.info(`Yeni bağlantı: ${socket.id}`);

  // Agent kaydı
  socket.on('agent:register', (data) => {
    agentManager.registerAgent(socket, data);
  });

  // Agent metrikleri
  socket.on('agent:metrics', (data) => {
    agentManager.handleMetrics(socket, data);
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    agentManager.handleDisconnect(socket);
  });
});

// Dashboard Socket bağlantıları (ayrı namespace)
const dashboardIo = io.of('/dashboard');

dashboardIo.on('connection', (socket) => {
  logger.info(`Dashboard bağlandı: ${socket.id}`);

  // Tüm sunucu durumlarını gönder
  socket.emit('servers:list', agentManager.getAllServers());

  // Dashboard'a gerçek zamanlı güncellemeler
  agentManager.on('server:update', (data) => {
    socket.emit('server:update', data);
  });

  agentManager.on('server:online', (data) => {
    socket.emit('server:online', data);
  });

  agentManager.on('server:offline', (data) => {
    socket.emit('server:offline', data);
  });
});

// Agent Manager'ı routes'a aktar
app.set('agentManager', agentManager);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/server-manager';

mongoose.connect(MONGODB_URI)
  .then(() => {
    logger.info('MongoDB bağlantısı başarılı');
  })
  .catch((err) => {
    logger.warn('MongoDB bağlantısı başarısız, in-memory mode kullanılıyor');
    logger.warn(err.message);
  });

// WhatsApp Bot başlat (opsiyonel)
if (process.env.WHATSAPP_ENABLED === 'true') {
  const whatsappBot = require('./services/whatsapp-bot');
  whatsappBot.initialize(agentManager);
}

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info('='.repeat(50));
  logger.info(`Server Manager Backend v1.0.0`);
  logger.info(`Port: ${PORT}`);
  logger.info(`Dashboard: http://localhost:${PORT}`);
  logger.info('='.repeat(50));
});
