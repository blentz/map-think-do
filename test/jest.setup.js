// Jest setup file for telemetry tests

// Mock fetch for tests that don't need real HTTP calls
global.fetch = require('node-fetch');

// Set up environment variables
process.env.NODE_ENV = 'test';
process.env.TELEMETRY_ENABLED = 'true';
process.env.PHOENIX_ENDPOINT = 'http://localhost:6006';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global teardown
afterAll(async () => {
  // Give time for any cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
});
