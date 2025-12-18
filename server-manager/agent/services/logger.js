const winston = require('winston');
const path = require('path');
const config = require('../config/default');

const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
  ),
  transports: [
    // Konsola yazdır
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      )
    }),
    // Dosyaya yazdır
    new winston.transports.File({
      filename: path.join(config.log.path, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(config.log.path, 'combined.log')
    })
  ]
});

module.exports = logger;
