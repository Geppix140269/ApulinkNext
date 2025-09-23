// Mock database for testing
const mockDatabase = {
  isConnected: true,
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { count: 1 }, error: null })),
          limit: jest.fn(() => Promise.resolve({ data: [{ count: 1 }], error: null }))
        })),
        limit: jest.fn(() => Promise.resolve({ data: [{ count: 1 }], error: null }))
      }))
    }))
  },

  async initialize() {
    this.isConnected = true;
    return this.supabase;
  },

  async testConnection() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return true;
  },

  getClient() {
    if (!this.isConnected) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.supabase;
  },

  async healthCheck() {
    return {
      status: 'healthy',
      responseTime: '1ms',
      connected: this.isConnected
    };
  },

  async close() {
    this.isConnected = false;
  }
};

module.exports = mockDatabase;