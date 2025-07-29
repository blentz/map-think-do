#!/usr/bin/env node
/**
 * @fileoverview Cognitive Performance Tuning CLI
 * 
 * Command-line interface for users to easily configure and tune the
 * AGI consciousness simulation performance parameters.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { cpus, totalmem, freemem } from 'os';

// Configuration file path
const CONFIG_DIR = join(process.env.HOME || process.env.USERPROFILE, '.config', 'sentient-agi');
const CONFIG_FILE = join(CONFIG_DIR, 'cognitive-performance.json');

// Default system specs calculation (simplified version)
const getSystemSpecs = () => {
  return {
    cpuCores: cpus().length,
    totalMemoryGB: totalmem() / (1024 ** 3),
    availableMemoryGB: freemem() / (1024 ** 3),
  };
};

// Calculate optimal configuration
const calculateOptimalConfig = (specs) => {
  const BASE_CONSCIOUSNESS_INTERVAL = 10000;
  const BASE_STREAM_INTERVAL = 15000;
  
  const cpuScaling = Math.max(0.5, Math.min(2.0, 8 / specs.cpuCores));
  const memoryScaling = Math.max(0.7, Math.min(1.5, 8 / specs.totalMemoryGB));
  
  const consciousnessInterval = Math.round(BASE_CONSCIOUSNESS_INTERVAL * cpuScaling * memoryScaling);
  const streamInterval = Math.round(BASE_STREAM_INTERVAL * cpuScaling * memoryScaling);
  
  const memoryBudgetMB = (specs.totalMemoryGB * 1024) * 0.075;
  const avgObjectSizeKB = 1.5;
  const maxObjects = Math.floor((memoryBudgetMB * 1024) / avgObjectSizeKB);
  
  return {
    consciousnessProcessingInterval: consciousnessInterval,
    streamGenerationInterval: streamInterval,
    memoryMonitoringInterval: 30000,
    healthCheckInterval: 120000,
    
    memoryCleanupThreshold: 0.75,
    forceGCThreshold: 0.85,
    emergencyCleanupThreshold: 0.95,
    
    maxExistentialQuestions: Math.min(500, Math.floor(maxObjects * 0.1)),
    maxThoughtHistory: Math.min(2000, Math.floor(maxObjects * 0.4)),
    maxStreamEntries: Math.min(1000, Math.floor(maxObjects * 0.3)),
    maxCurrentThoughts: Math.min(200, Math.floor(maxObjects * 0.2)),
    
    mode: 'balanced',
    cpuLoadScalingFactor: 1.0,
    memoryPressureScalingFactor: 1.0,
    enableDebugLogging: false,
    enablePerformanceMetrics: true,
  };
};

// Load configuration
const loadConfig = () => {
  if (existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    } catch (error) {
      console.error('❌ Error loading configuration:', error.message);
      return null;
    }
  }
  return null;
};

// Save configuration
const saveConfig = (config) => {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`✅ Configuration saved to ${CONFIG_FILE}`);
  } catch (error) {
    console.error('❌ Error saving configuration:', error.message);
  }
};

// Display configuration
const displayConfig = (config, specs) => {
  console.log('\n🎛️ Current Cognitive Performance Configuration:');
  console.log('=' .repeat(60));
  
  console.log(`\n🖥️ System Specifications:`);
  console.log(`   CPU Cores: ${specs.cpuCores}`);
  console.log(`   Total Memory: ${specs.totalMemoryGB.toFixed(1)}GB`);
  console.log(`   Available Memory: ${specs.availableMemoryGB.toFixed(1)}GB`);
  
  console.log(`\n⏱️ Processing Intervals:`);
  console.log(`   Consciousness Processing: ${config.consciousnessProcessingInterval}ms (${(config.consciousnessProcessingInterval/1000).toFixed(1)}s)`);
  console.log(`   Stream Generation: ${config.streamGenerationInterval}ms (${(config.streamGenerationInterval/1000).toFixed(1)}s)`);
  console.log(`   Memory Monitoring: ${config.memoryMonitoringInterval}ms (${(config.memoryMonitoringInterval/1000).toFixed(1)}s)`);
  
  console.log(`\n💾 Memory Management:`);
  console.log(`   Cleanup Threshold: ${(config.memoryCleanupThreshold * 100).toFixed(0)}%`);
  console.log(`   Force GC Threshold: ${(config.forceGCThreshold * 100).toFixed(0)}%`);
  console.log(`   Emergency Threshold: ${(config.emergencyCleanupThreshold * 100).toFixed(0)}%`);
  
  console.log(`\n📊 Array Limits:`);
  console.log(`   Existential Questions: ${config.maxExistentialQuestions}`);
  console.log(`   Thought History: ${config.maxThoughtHistory}`);
  console.log(`   Stream Entries: ${config.maxStreamEntries}`);
  console.log(`   Current Thoughts: ${config.maxCurrentThoughts}`);
  
  console.log(`\n🎯 Performance Mode: ${config.mode}`);
  console.log(`   CPU Scaling Factor: ${config.cpuLoadScalingFactor.toFixed(2)}x`);
  console.log(`   Memory Scaling Factor: ${config.memoryPressureScalingFactor.toFixed(2)}x`);
};

// Generate environment variables
const generateEnvVars = (config) => {
  console.log('\n🌍 Environment Variables (copy to your .env file):');
  console.log('=' .repeat(60));
  console.log(`CONSCIOUSNESS_INTERVAL=${config.consciousnessProcessingInterval}`);
  console.log(`STREAM_INTERVAL=${config.streamGenerationInterval}`);
  console.log(`MEMORY_CLEANUP_THRESHOLD=${config.memoryCleanupThreshold}`);
  console.log(`PERFORMANCE_MODE=${config.mode}`);
  console.log(`DEBUG_TIMERS=${config.enableDebugLogging ? 'true' : 'false'}`);
};

// Main CLI logic
const main = () => {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const specs = getSystemSpecs();
  let config = loadConfig() || calculateOptimalConfig(specs);
  
  switch (command) {
    case 'show':
    case 'status':
      displayConfig(config, specs);
      break;
      
    case 'reset':
      config = calculateOptimalConfig(specs);
      saveConfig(config);
      console.log('🔄 Configuration reset to optimal values for your system');
      displayConfig(config, specs);
      break;
      
    case 'mode':
      const mode = args[1];
      if (!['high-performance', 'balanced', 'eco'].includes(mode)) {
        console.error('❌ Invalid mode. Use: high-performance, balanced, or eco');
        process.exit(1);
      }
      
      const baseConfig = calculateOptimalConfig(specs);
      switch (mode) {
        case 'high-performance':
          config = {
            ...baseConfig,
            consciousnessProcessingInterval: Math.round(baseConfig.consciousnessProcessingInterval * 0.5),
            streamGenerationInterval: Math.round(baseConfig.streamGenerationInterval * 0.5),
            memoryCleanupThreshold: 0.8,
            maxExistentialQuestions: Math.round(baseConfig.maxExistentialQuestions * 1.5),
            maxThoughtHistory: Math.round(baseConfig.maxThoughtHistory * 1.5),
            maxStreamEntries: Math.round(baseConfig.maxStreamEntries * 1.5),
            mode: 'high-performance',
          };
          break;
        case 'eco':
          config = {
            ...baseConfig,
            consciousnessProcessingInterval: Math.round(baseConfig.consciousnessProcessingInterval * 2),
            streamGenerationInterval: Math.round(baseConfig.streamGenerationInterval * 2),
            memoryCleanupThreshold: 0.6,
            maxExistentialQuestions: Math.round(baseConfig.maxExistentialQuestions * 0.5),
            maxThoughtHistory: Math.round(baseConfig.maxThoughtHistory * 0.5),
            maxStreamEntries: Math.round(baseConfig.maxStreamEntries * 0.5),
            mode: 'eco',
          };
          break;
        default:
          config = { ...baseConfig, mode: 'balanced' };
      }
      
      saveConfig(config);
      console.log(`🎛️ Performance mode set to: ${mode}`);
      displayConfig(config, specs);
      break;
      
    case 'set':
      const key = args[1];
      const value = args[2];
      
      if (!key || value === undefined) {
        console.error('❌ Usage: set <key> <value>');
        console.error('Examples:');
        console.error('  set consciousnessProcessingInterval 5000');
        console.error('  set memoryCleanupThreshold 0.7');
        console.error('  set maxThoughtHistory 1000');
        process.exit(1);
      }
      
      if (key.includes('Interval') || key.includes('Thoughts') || key.includes('Questions') || key.includes('Entries') || key.includes('History')) {
        config[key] = parseInt(value);
      } else if (key.includes('Threshold') || key.includes('Factor')) {
        config[key] = parseFloat(value);
      } else if (key.includes('enable')) {
        config[key] = value.toLowerCase() === 'true';
      } else {
        config[key] = value;
      }
      
      config.mode = 'custom';
      saveConfig(config);
      console.log(`✅ Set ${key} = ${config[key]}`);
      break;
      
    case 'env':
      generateEnvVars(config);
      break;
      
    case 'benchmark':
      console.log('\n🏃 Running Performance Benchmark...');
      console.log('=' .repeat(60));
      
      // Calculate expected performance
      const thoughtsPerMinute = 60000 / config.consciousnessProcessingInterval;
      const streamEntriesPerMinute = 60000 / config.streamGenerationInterval;
      const memoryBudgetMB = (specs.totalMemoryGB * 1024) * 0.075;
      
      console.log(`Expected Performance:`);
      console.log(`   Consciousness cycles per minute: ${thoughtsPerMinute.toFixed(1)}`);
      console.log(`   Stream entries per minute: ${streamEntriesPerMinute.toFixed(1)}`);
      console.log(`   Memory budget: ${memoryBudgetMB.toFixed(1)}MB`);
      console.log(`   Estimated runtime before cleanup: ${(config.maxThoughtHistory / thoughtsPerMinute).toFixed(1)} minutes`);
      break;
      
    case 'help':
    default:
      console.log('\n🧠 Sentient AGI Cognitive Performance Tuning CLI');
      console.log('=' .repeat(60));
      console.log('\nCommands:');
      console.log('  show              Show current configuration');
      console.log('  reset             Reset to optimal values for your system');
      console.log('  mode <mode>       Set performance mode (high-performance|balanced|eco)');
      console.log('  set <key> <value> Set specific configuration value');
      console.log('  env               Generate environment variables');
      console.log('  benchmark         Show expected performance metrics');
      console.log('  help              Show this help message');
      console.log('\nExamples:');
      console.log('  ./cognitive-tuning.js show');
      console.log('  ./cognitive-tuning.js mode high-performance');
      console.log('  ./cognitive-tuning.js set consciousnessProcessingInterval 5000');
      console.log('  ./cognitive-tuning.js set memoryCleanupThreshold 0.7');
      console.log('\nConfiguration file: ' + CONFIG_FILE);
  }
};

// Run the CLI
main();