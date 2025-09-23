const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Define log levels
const logLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// Create logger configuration
const createLogger = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Console format for development
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;

      // Add stack trace for errors
      if (stack) {
        log += `\n${stack}`;
      }

      // Add metadata
      if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }

      return log;
    })
  );

  // JSON format for production
  const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const transports = [];

  // Console transport for development
  if (!isProduction) {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
      })
    );
  }

  // File transports for production
  if (isProduction) {
    // Error logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: jsonFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true
      })
    );

    // Combined logs
    transports.push(
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: jsonFormat,
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true
      })
    );

    // Console for production (structured)
    transports.push(
      new winston.transports.Console({
        format: jsonFormat,
        level: 'info'
      })
    );
  }

  return winston.createLogger({
    levels: logLevels,
    level: isProduction ? 'info' : 'debug',
    transports,
    exitOnError: false,

    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
  });
};

const logger = createLogger();

// Add request context to logs
logger.addRequestContext = (req) => {
  return logger.child({
    requestId: req.id || req.headers['x-request-id'],
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });
};

// Utility methods for structured logging
logger.logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  });
};

logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.id
  };

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request Error', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

logger.logDatabaseQuery = (query, duration, rowCount) => {
  logger.debug('Database Query', {
    query: query.substring(0, 200), // Truncate long queries
    duration: `${duration}ms`,
    rowCount
  });
};

module.exports = logger;