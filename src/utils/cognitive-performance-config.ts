/**
 * @fileoverview Cognitive Performance Configuration System
 * 
 * Calculates optimal timing intervals based on system specifications and provides
 * user-configurable performance tuning for the AGI consciousness simulation.
 */

import { cpus, freemem, totalmem } from 'os';

export interface SystemSpecs {
  cpuCores: number;
  totalMemoryGB: number;
  availableMemoryGB: number;
  nodeVersion: string;
}

export interface CognitivePerformanceConfig {
  // Core processing intervals (milliseconds)
  consciousnessProcessingInterval: number;
  streamGenerationInterval: number;
  memoryMonitoringInterval: number;
  healthCheckInterval: number;
  
  // Memory management thresholds
  memoryCleanupThreshold: number; // 0-1 (percentage)
  forceGCThreshold: number; // 0-1 (percentage)
  emergencyCleanupThreshold: number; // 0-1 (percentage)
  
  // Array size limits
  maxExistentialQuestions: number;
  maxThoughtHistory: number;
  maxStreamEntries: number;
  maxCurrentThoughts: number;
  
  // Performance mode
  mode: 'high-performance' | 'balanced' | 'eco' | 'custom';
  
  // Adaptive scaling factors
  cpuLoadScalingFactor: number; // 0.5-2.0
  memoryPressureScalingFactor: number; // 0.5-2.0
  
  // Development/debugging
  enableDebugLogging: boolean;
  enablePerformanceMetrics: boolean;
}

/**
 * Cognitive Performance Configuration Manager
 */
export class CognitivePerformanceConfigManager {
  private static instance: CognitivePerformanceConfigManager;
  private config: CognitivePerformanceConfig;
  private systemSpecs: SystemSpecs;

  private constructor() {
    this.systemSpecs = this.analyzeSystemSpecs();
    this.config = this.calculateOptimalConfig();
  }

  static getInstance(): CognitivePerformanceConfigManager {
    if (!CognitivePerformanceConfigManager.instance) {
      CognitivePerformanceConfigManager.instance = new CognitivePerformanceConfigManager();
    }
    return CognitivePerformanceConfigManager.instance;
  }

  /**
   * Analyze current system specifications
   */
  private analyzeSystemSpecs(): SystemSpecs {
    const totalMemoryBytes = totalmem();
    const freeMemoryBytes = freemem();
    
    return {
      cpuCores: cpus().length,
      totalMemoryGB: totalMemoryBytes / (1024 ** 3),
      availableMemoryGB: freeMemoryBytes / (1024 ** 3),
      nodeVersion: process.version,
    };
  }

  /**
   * Calculate optimal configuration based on system specs
   * 
   * MATHEMATICAL APPROACH:
   * 
   * 1. Consciousness Processing Interval:
   *    - Base interval: 10000ms (good for consciousness simulation)
   *    - CPU scaling: More cores = faster processing possible
   *    - Memory scaling: More memory = can handle more frequent processing
   *    - Formula: baseInterval * (8 / cpuCores) * (4 / memoryGB)
   *    
   * 2. Stream Generation Interval:
   *    - Base interval: 15000ms (less critical than consciousness)
   *    - Should be 1.5x consciousness interval for good balance
   *    
   * 3. Memory Limits:
   *    - Scale with available memory
   *    - Conservative: Use only 10-15% of total memory for cognitive arrays
   *    - Each thought ~1KB, each stream entry ~500B, each question ~2KB
   */
  private calculateOptimalConfig(): CognitivePerformanceConfig {
    const specs = this.systemSpecs;
    
    console.log(`🧠 Calculating optimal config for system:`);
    console.log(`   CPU Cores: ${specs.cpuCores}`);
    console.log(`   Total Memory: ${specs.totalMemoryGB.toFixed(1)}GB`);
    console.log(`   Available Memory: ${specs.availableMemoryGB.toFixed(1)}GB`);

    // Base intervals (milliseconds)
    const BASE_CONSCIOUSNESS_INTERVAL = 10000; // 10 seconds
    const BASE_STREAM_INTERVAL = 15000; // 15 seconds
    
    // CPU scaling factor: More cores = can process faster
    // Formula: Inverse relationship with diminishing returns
    const cpuScaling = Math.max(0.5, Math.min(2.0, 8 / specs.cpuCores));
    
    // Memory scaling factor: More memory = can handle more frequent processing  
    // Formula: Inverse relationship with available memory
    const memoryScaling = Math.max(0.7, Math.min(1.5, 8 / specs.totalMemoryGB));
    
    // Calculate final intervals
    const consciousnessInterval = Math.round(BASE_CONSCIOUSNESS_INTERVAL * cpuScaling * memoryScaling);
    const streamInterval = Math.round(BASE_STREAM_INTERVAL * cpuScaling * memoryScaling);
    
    console.log(`📊 Scaling calculations:`);
    console.log(`   CPU scaling factor: ${cpuScaling.toFixed(2)} (${specs.cpuCores} cores)`);
    console.log(`   Memory scaling factor: ${memoryScaling.toFixed(2)} (${specs.totalMemoryGB.toFixed(1)}GB)`);
    console.log(`   Final consciousness interval: ${consciousnessInterval}ms`);
    console.log(`   Final stream interval: ${streamInterval}ms`);

    // Memory-based array limits
    // Assumption: Each cognitive object uses ~1-2KB
    // Use 5-10% of total memory for cognitive arrays
    const memoryBudgetMB = (specs.totalMemoryGB * 1024) * 0.075; // 7.5% of total memory
    const avgObjectSizeKB = 1.5; // Average size per cognitive object
    const maxObjects = Math.floor((memoryBudgetMB * 1024) / avgObjectSizeKB);
    
    // Distribute among different array types
    const maxExistentialQuestions = Math.min(500, Math.floor(maxObjects * 0.1)); // 10%
    const maxThoughtHistory = Math.min(2000, Math.floor(maxObjects * 0.4)); // 40%
    const maxStreamEntries = Math.min(1000, Math.floor(maxObjects * 0.3)); // 30%
    const maxCurrentThoughts = Math.min(200, Math.floor(maxObjects * 0.2)); // 20%

    console.log(`💾 Memory allocation calculations:`);
    console.log(`   Memory budget: ${memoryBudgetMB.toFixed(1)}MB (7.5% of ${specs.totalMemoryGB.toFixed(1)}GB)`);
    console.log(`   Max objects: ${maxObjects}`);
    console.log(`   Existential questions: ${maxExistentialQuestions}`);
    console.log(`   Thought history: ${maxThoughtHistory}`);
    console.log(`   Stream entries: ${maxStreamEntries}`);
    console.log(`   Current thoughts: ${maxCurrentThoughts}`);

    return {
      consciousnessProcessingInterval: consciousnessInterval,
      streamGenerationInterval: streamInterval,
      memoryMonitoringInterval: 30000, // 30 seconds
      healthCheckInterval: 120000, // 2 minutes
      
      memoryCleanupThreshold: 0.75, // Cleanup at 75% memory usage
      forceGCThreshold: 0.85, // Force GC at 85% memory usage
      emergencyCleanupThreshold: 0.95, // Emergency cleanup at 95% memory usage
      
      maxExistentialQuestions,
      maxThoughtHistory,
      maxStreamEntries,
      maxCurrentThoughts,
      
      mode: 'balanced',
      
      cpuLoadScalingFactor: 1.0,
      memoryPressureScalingFactor: 1.0,
      
      enableDebugLogging: process.env.NODE_ENV === 'development',
      enablePerformanceMetrics: true,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): CognitivePerformanceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with user values
   */
  updateConfig(updates: Partial<CognitivePerformanceConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log(`⚙️ Configuration updated:`, updates);
  }

  /**
   * Apply performance mode preset
   */
  setPerformanceMode(mode: CognitivePerformanceConfig['mode']): void {
    const baseConfig = this.calculateOptimalConfig();
    
    switch (mode) {
      case 'high-performance':
        this.config = {
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
        this.config = {
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
        
      case 'balanced':
      default:
        this.config = { ...baseConfig, mode: 'balanced' };
        break;
    }
    
    console.log(`🎛️ Performance mode set to: ${mode}`);
    this.logCurrentSettings();
  }

  /**
   * Adapt configuration based on current system load
   */
  adaptToCurrentLoad(): void {
    const currentMemory = process.memoryUsage();
    const memoryUsagePercent = currentMemory.heapUsed / currentMemory.heapTotal;
    
    // Adaptive scaling based on memory pressure
    if (memoryUsagePercent > 0.8) {
      // High memory pressure - slow down
      this.config.memoryPressureScalingFactor = Math.min(2.0, this.config.memoryPressureScalingFactor * 1.2);
    } else if (memoryUsagePercent < 0.4) {
      // Low memory pressure - can speed up
      this.config.memoryPressureScalingFactor = Math.max(0.5, this.config.memoryPressureScalingFactor * 0.9);
    }
    
    if (this.config.enableDebugLogging) {
      console.log(`📈 Adaptive scaling: memory usage ${(memoryUsagePercent * 100).toFixed(1)}%, scaling factor: ${this.config.memoryPressureScalingFactor.toFixed(2)}`);
    }
  }

  /**
   * Get effective intervals with current scaling factors applied
   */
  getEffectiveIntervals(): {
    consciousnessInterval: number;
    streamInterval: number;
    memoryMonitoringInterval: number;
  } {
    const scaling = this.config.cpuLoadScalingFactor * this.config.memoryPressureScalingFactor;
    
    return {
      consciousnessInterval: Math.round(this.config.consciousnessProcessingInterval * scaling),
      streamInterval: Math.round(this.config.streamGenerationInterval * scaling),
      memoryMonitoringInterval: this.config.memoryMonitoringInterval,
    };
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment(): void {
    const envConfig: Partial<CognitivePerformanceConfig> = {};
    
    if (process.env.CONSCIOUSNESS_INTERVAL) {
      envConfig.consciousnessProcessingInterval = parseInt(process.env.CONSCIOUSNESS_INTERVAL);
    }
    
    if (process.env.STREAM_INTERVAL) {
      envConfig.streamGenerationInterval = parseInt(process.env.STREAM_INTERVAL);
    }
    
    if (process.env.MEMORY_CLEANUP_THRESHOLD) {
      envConfig.memoryCleanupThreshold = parseFloat(process.env.MEMORY_CLEANUP_THRESHOLD);
    }
    
    if (process.env.PERFORMANCE_MODE) {
      const mode = process.env.PERFORMANCE_MODE as CognitivePerformanceConfig['mode'];
      if (['high-performance', 'balanced', 'eco', 'custom'].includes(mode)) {
        this.setPerformanceMode(mode);
        return; // Performance mode overrides individual settings
      }
    }
    
    if (Object.keys(envConfig).length > 0) {
      envConfig.mode = 'custom';
      this.updateConfig(envConfig);
      console.log(`🌍 Configuration loaded from environment variables`);
    }
  }

  /**
   * Export configuration for user editing
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.updateConfig(importedConfig);
      console.log(`📥 Configuration imported successfully`);
    } catch (error) {
      console.error(`❌ Failed to import configuration:`, error);
      throw new Error('Invalid configuration JSON');
    }
  }

  /**
   * Log current configuration settings
   */
  logCurrentSettings(): void {
    const effective = this.getEffectiveIntervals();
    
    console.log(`\n🎛️ Current Cognitive Performance Settings:`);
    console.log(`   Mode: ${this.config.mode}`);
    console.log(`   Consciousness processing: ${effective.consciousnessInterval}ms`);
    console.log(`   Stream generation: ${effective.streamInterval}ms`);
    console.log(`   Memory cleanup threshold: ${(this.config.memoryCleanupThreshold * 100).toFixed(0)}%`);
    console.log(`   Max existential questions: ${this.config.maxExistentialQuestions}`);
    console.log(`   Max thought history: ${this.config.maxThoughtHistory}`);
    console.log(`   Max stream entries: ${this.config.maxStreamEntries}`);
    console.log(`   Max current thoughts: ${this.config.maxCurrentThoughts}`);
    console.log(`   CPU load scaling: ${this.config.cpuLoadScalingFactor.toFixed(2)}x`);
    console.log(`   Memory pressure scaling: ${this.config.memoryPressureScalingFactor.toFixed(2)}x\n`);
  }

  /**
   * Get system specifications
   */
  getSystemSpecs(): SystemSpecs {
    return { ...this.systemSpecs };
  }
}