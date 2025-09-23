// Jest setup file
require('dotenv').config({ path: '.env.test' });

// Mock console methods in tests to reduce noise
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

// Mock database configuration
const mockDatabase = require('./__tests__/setup/mockDatabase');
jest.doMock('./src/config/database', () => mockDatabase);

// Initialize mock database before tests
beforeAll(async () => {
  await mockDatabase.initialize();
});