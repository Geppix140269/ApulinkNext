const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

class DatabaseConfig {
  constructor() {
    this.supabase = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing required Supabase configuration');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      });

      // Test connection
      await this.testConnection();

      this.isConnected = true;
      logger.info('Database connection established successfully');

      return this.supabase;
    } catch (error) {
      logger.logError(error, { context: 'Database initialization' });
      throw error;
    }
  }

  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('service_providers')
        .select('count(*)')
        .limit(1);

      if (error) {
        throw error;
      }

      logger.debug('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed', { error: error.message });
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  getClient() {
    if (!this.supabase || !this.isConnected) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.supabase;
  }

  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'error', message: 'Database not connected' };
      }

      const startTime = Date.now();
      await this.testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        connected: this.isConnected
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        connected: false
      };
    }
  }

  async close() {
    if (this.supabase) {
      // Supabase client doesn't require explicit closing
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }
}

// Create singleton instance
const databaseConfig = new DatabaseConfig();

module.exports = databaseConfig;