module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'context-attributes-simple.test.ts', // This uses custom test runner format
    'unit-test-runner.ts',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        module: 'esnext',
      },
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((@modelcontextprotocol/sdk)|(@opentelemetry/.*)|node-fetch))',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid conflicts
  forceExit: true,
  detectOpenHandles: true,
};
