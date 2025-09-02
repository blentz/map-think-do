const { TelemetryConfig } = require('./dist/telemetry/telemetry-config.js');

// Test 1: Default project name
process.env.PHOENIX_PROJECT_NAME = undefined;
const config1 = new TelemetryConfig();
console.log(
  'Test 1 - Default:',
  config1.getProjectName() === 'sentient-agi-reasoning' ? '✅ PASS' : '❌ FAIL'
);

// Test 2: Environment variable
process.env.PHOENIX_PROJECT_NAME = 'test-project-xyz';
const config2 = new TelemetryConfig();
console.log(
  'Test 2 - Env var:',
  config2.getProjectName() === 'test-project-xyz' ? '✅ PASS' : '❌ FAIL'
);

// Test 3: Config object has projectName field
console.log('Test 3 - Field exists:', 'projectName' in config2.config ? '✅ PASS' : '❌ FAIL');
