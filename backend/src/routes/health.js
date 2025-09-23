const express = require('express');
const databaseConfig = require('../config/database');
const logger = require('../utils/logger');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// Basic health check
router.get('/health', catchAsync(async (req, res) => {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '2.0.0',
    services: {}
  };

  // Check database
  try {
    const dbHealth = await databaseConfig.healthCheck();
    health.services.database = dbHealth;
  } catch (error) {
    health.services.database = {
      status: 'error',
      message: error.message
    };
    health.status = 'degraded';
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  health.services.memory = {
    status: 'healthy',
    usage: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    }
  };

  // Check CPU load (simplified)
  const cpuUsage = process.cpuUsage();
  health.services.cpu = {
    status: 'healthy',
    usage: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  };

  const responseTime = Date.now() - startTime;
  health.responseTime = `${responseTime}ms`;

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 :
                    health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
}));

// Detailed health check for monitoring systems
router.get('/health/detailed', catchAsync(async (req, res) => {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '2.0.0',
    pid: process.pid,
    node_version: process.version,
    services: {},
    metrics: {}
  };

  // Database health with detailed metrics
  try {
    const dbHealth = await databaseConfig.healthCheck();
    health.services.database = dbHealth;

    // Test a simple query for response time
    const queryStart = Date.now();
    const supabase = databaseConfig.getClient();
    await supabase.from('service_providers').select('count(*)').limit(1);
    const queryTime = Date.now() - queryStart;

    health.metrics.database_query_time = `${queryTime}ms`;
  } catch (error) {
    health.services.database = {
      status: 'error',
      message: error.message
    };
    health.status = 'unhealthy';
  }

  // Memory metrics
  const memoryUsage = process.memoryUsage();
  health.services.memory = {
    status: memoryUsage.heapUsed > 100 * 1024 * 1024 ? 'warning' : 'healthy',
    usage: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      heapUsedPercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
    }
  };

  // Event loop delay (simplified check)
  health.services.eventLoop = {
    status: 'healthy',
    message: 'Event loop is responsive'
  };

  // Environment variables check (without exposing values)
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'NODE_ENV'
  ];

  const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);

  health.services.environment = {
    status: missingEnvVars.length === 0 ? 'healthy' : 'error',
    requiredVariables: requiredEnvVars.length,
    missingVariables: missingEnvVars.length,
    missing: missingEnvVars
  };

  if (missingEnvVars.length > 0) {
    health.status = 'unhealthy';
  }

  const responseTime = Date.now() - startTime;
  health.responseTime = `${responseTime}ms`;
  health.metrics.health_check_time = `${responseTime}ms`;

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 503;

  // Log health check for monitoring
  if (health.status !== 'healthy') {
    logger.warn('Health check failed', health);
  }

  res.status(statusCode).json(health);
}));

// Readiness probe (for Kubernetes)
router.get('/ready', catchAsync(async (req, res) => {
  try {
    // Check if database is ready
    await databaseConfig.testConnection();

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;