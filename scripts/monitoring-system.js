#!/usr/bin/env node

/**
 * @fileoverview Real-time PRP Monitoring System
 * 
 * Monitors the PostgreSQL Stored Prompts Integration in real-time
 * using actual database queries and performance measurements.
 */

import { PostgreSQLMemoryStore } from '../dist/src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../dist/src/memory/postgresql-config.js';
import { SQLBasedValidation } from '../dist/src/memory/prompt-intelligence/sql-based-validation.js';
import { RealMetricsCalculator } from '../dist/src/memory/prompt-intelligence/metrics-calculator.js';
import { writeFile } from 'fs/promises';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

class PRPMonitoringSystem {
  constructor() {
    this.memoryStore = null;
    this.sqlValidation = null;
    this.metricsCalculator = null;
    this.monitoringInterval = null;
    this.alertThresholds = {
      prompt_capture_rate: 0.995,
      storage_performance_avg: 10,
      query_response_time: 50,
      memory_efficiency: 0.12,
      classification_accuracy: 0.85,
      intent_extraction_precision: 0.80,
      similarity_detection_recall: 0.90
    };
    this.alertHistory = [];
  }

  async initialize() {
    logInfo("Initializing PRP Monitoring System...");
    
    this.memoryStore = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
    await this.memoryStore.initialize();
    
    this.sqlValidation = new SQLBasedValidation(this.memoryStore);
    this.metricsCalculator = new RealMetricsCalculator(this.memoryStore);
    
    logSuccess("PRP Monitoring System initialized");
  }

  async collectRealTimeMetrics() {
    const timestamp = new Date();
    const metrics = {
      timestamp: timestamp.toISOString(),
      system_health: {},
      performance_metrics: {},
      database_health: {},
      alerts: []
    };

    try {
      // Collect system health metrics
      const memoryUsage = process.memoryUsage();
      metrics.system_health = {
        heap_used: memoryUsage.heapUsed,
        heap_total: memoryUsage.heapTotal,
        memory_efficiency: memoryUsage.heapUsed / memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      };

      // Collect database health metrics
      const sqlResult = await this.sqlValidation.runSQLValidation();
      const performanceMetrics = await this.sqlValidation.calculateRealPerformanceMetrics();
      
      metrics.database_health = {
        total_prompts: this.extractMetricValue(sqlResult.metrics, 'total_prompts_count'),
        recent_prompts: this.extractMetricValue(sqlResult.metrics, 'prompts_last_24h'),
        unique_sessions: this.extractMetricValue(sqlResult.metrics, 'unique_session_count'),
        processing_success_rate: this.extractProcessingSuccessRate(sqlResult.metrics),
        query_execution_times: sqlResult.metrics.map(m => m.execution_time_ms),
        avg_query_time: sqlResult.metrics.reduce((sum, m) => sum + m.execution_time_ms, 0) / sqlResult.metrics.length
      };

      // Collect performance metrics
      metrics.performance_metrics = {
        classification_accuracy: performanceMetrics.classification_accuracy,
        intent_extraction_precision: performanceMetrics.intent_extraction_precision,
        similarity_detection_recall: performanceMetrics.similarity_detection_recall,
        reasoning_improvement_average: performanceMetrics.reasoning_improvement_average,
        storage_performance_ms: performanceMetrics.storage_performance_ms
      };

      // Check for alerts
      metrics.alerts = this.checkAlerts(metrics);

      return metrics;

    } catch (error) {
      logError(`Error collecting metrics: ${error.message}`);
      metrics.error = error.message;
      return metrics;
    }
  }

  extractMetricValue(metrics, name) {
    const metric = metrics.find(m => m.name === name);
    return metric ? (typeof metric.value === 'string' && metric.value.startsWith('ERROR:') ? 0 : parseInt(metric.value) || 0) : 0;
  }

  extractProcessingSuccessRate(metrics) {
    const metric = metrics.find(m => m.name === 'processing_success_rate');
    if (metric && typeof metric.value === 'object' && metric.value.success_rate) {
      return parseFloat(metric.value.success_rate);
    }
    return 0;
  }

  checkAlerts(metrics) {
    const alerts = [];
    const timestamp = new Date().toISOString();

    // Check memory efficiency
    if (metrics.system_health.memory_efficiency > this.alertThresholds.memory_efficiency) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'warning',
        message: `Memory efficiency ${(metrics.system_health.memory_efficiency * 100).toFixed(1)}% exceeds threshold ${(this.alertThresholds.memory_efficiency * 100).toFixed(1)}%`,
        value: metrics.system_health.memory_efficiency,
        threshold: this.alertThresholds.memory_efficiency,
        timestamp
      });
    }

    // Check query response time
    if (metrics.database_health.avg_query_time > this.alertThresholds.query_response_time) {
      alerts.push({
        type: 'SLOW_QUERIES',
        severity: 'warning',
        message: `Average query time ${metrics.database_health.avg_query_time.toFixed(1)}ms exceeds threshold ${this.alertThresholds.query_response_time}ms`,
        value: metrics.database_health.avg_query_time,
        threshold: this.alertThresholds.query_response_time,
        timestamp
      });
    }

    // Check classification accuracy
    if (metrics.performance_metrics.classification_accuracy < this.alertThresholds.classification_accuracy) {
      alerts.push({
        type: 'LOW_CLASSIFICATION_ACCURACY',
        severity: 'error',
        message: `Classification accuracy ${(metrics.performance_metrics.classification_accuracy * 100).toFixed(1)}% below threshold ${(this.alertThresholds.classification_accuracy * 100).toFixed(1)}%`,
        value: metrics.performance_metrics.classification_accuracy,
        threshold: this.alertThresholds.classification_accuracy,
        timestamp
      });
    }

    // Check intent extraction precision
    if (metrics.performance_metrics.intent_extraction_precision < this.alertThresholds.intent_extraction_precision) {
      alerts.push({
        type: 'LOW_INTENT_PRECISION',
        severity: 'error',
        message: `Intent extraction precision ${(metrics.performance_metrics.intent_extraction_precision * 100).toFixed(1)}% below threshold ${(this.alertThresholds.intent_extraction_precision * 100).toFixed(1)}%`,
        value: metrics.performance_metrics.intent_extraction_precision,
        threshold: this.alertThresholds.intent_extraction_precision,
        timestamp
      });
    }

    // Check similarity detection recall
    if (metrics.performance_metrics.similarity_detection_recall < this.alertThresholds.similarity_detection_recall) {
      alerts.push({
        type: 'LOW_SIMILARITY_RECALL',
        severity: 'error',
        message: `Similarity detection recall ${(metrics.performance_metrics.similarity_detection_recall * 100).toFixed(1)}% below threshold ${(this.alertThresholds.similarity_detection_recall * 100).toFixed(1)}%`,
        value: metrics.performance_metrics.similarity_detection_recall,
        threshold: this.alertThresholds.similarity_detection_recall,
        timestamp
      });
    }

    // Check for no recent prompts (system not being used)
    if (metrics.database_health.recent_prompts === 0) {
      alerts.push({
        type: 'NO_RECENT_ACTIVITY',
        severity: 'info',
        message: 'No prompts received in the last 24 hours - system may not be in active use',
        value: 0,
        threshold: 1,
        timestamp
      });
    }

    return alerts;
  }

  displayMetrics(metrics) {
    console.clear();
    log(`${colors.bold}${colors.magenta}🔍 PRP Real-time Monitoring Dashboard${colors.reset}`);
    log(`================================================================`);
    log(`Last Updated: ${new Date(metrics.timestamp).toLocaleString()}`, colors.cyan);
    log('');

    // System Health
    log(`${colors.bold}SYSTEM HEALTH:${colors.reset}`);
    log(`  Memory Usage: ${(metrics.system_health.heap_used / 1024 / 1024).toFixed(1)}MB / ${(metrics.system_health.heap_total / 1024 / 1024).toFixed(1)}MB`, colors.cyan);
    log(`  Memory Efficiency: ${(metrics.system_health.memory_efficiency * 100).toFixed(1)}% ${metrics.system_health.memory_efficiency <= this.alertThresholds.memory_efficiency ? '✅' : '⚠️'}`, colors.cyan);
    log(`  RSS: ${(metrics.system_health.rss / 1024 / 1024).toFixed(1)}MB`, colors.cyan);
    log('');

    // Database Health
    log(`${colors.bold}DATABASE HEALTH:${colors.reset}`);
    log(`  Total Prompts: ${metrics.database_health.total_prompts}`, colors.cyan);
    log(`  Recent Prompts (24h): ${metrics.database_health.recent_prompts}`, colors.cyan);
    log(`  Unique Sessions: ${metrics.database_health.unique_sessions}`, colors.cyan);
    log(`  Processing Success Rate: ${(metrics.database_health.processing_success_rate * 100).toFixed(1)}%`, colors.cyan);
    log(`  Average Query Time: ${metrics.database_health.avg_query_time.toFixed(1)}ms ${metrics.database_health.avg_query_time <= this.alertThresholds.query_response_time ? '✅' : '⚠️'}`, colors.cyan);
    log('');

    // Performance Metrics
    log(`${colors.bold}AI PERFORMANCE METRICS:${colors.reset}`);
    log(`  Classification Accuracy: ${(metrics.performance_metrics.classification_accuracy * 100).toFixed(1)}% ${metrics.performance_metrics.classification_accuracy >= this.alertThresholds.classification_accuracy ? '✅' : '❌'}`, colors.cyan);
    log(`  Intent Extraction Precision: ${(metrics.performance_metrics.intent_extraction_precision * 100).toFixed(1)}% ${metrics.performance_metrics.intent_extraction_precision >= this.alertThresholds.intent_extraction_precision ? '✅' : '❌'}`, colors.cyan);
    log(`  Similarity Detection Recall: ${(metrics.performance_metrics.similarity_detection_recall * 100).toFixed(1)}% ${metrics.performance_metrics.similarity_detection_recall >= this.alertThresholds.similarity_detection_recall ? '✅' : '❌'}`, colors.cyan);
    log(`  Reasoning Improvement: ${(metrics.performance_metrics.reasoning_improvement_average * 100).toFixed(1)}%`, colors.cyan);
    log(`  Storage Performance: ${metrics.performance_metrics.storage_performance_ms.toFixed(1)}ms`, colors.cyan);
    log('');

    // Alerts
    if (metrics.alerts.length > 0) {
      log(`${colors.bold}🚨 ACTIVE ALERTS:${colors.reset}`);
      for (const alert of metrics.alerts) {
        const severityColor = alert.severity === 'error' ? colors.red : 
                             alert.severity === 'warning' ? colors.yellow : colors.blue;
        log(`  ${alert.type}: ${alert.message}`, severityColor);
      }
      log('');
    } else {
      logSuccess("✅ No active alerts - all systems operating normally");
      log('');
    }

    // Quick stats
    log(`${colors.bold}QUICK STATS:${colors.reset}`);
    log(`  Monitoring uptime: ${this.getUptime()}`, colors.cyan);
    log(`  Total alerts generated: ${this.alertHistory.length}`, colors.cyan);
    log(`  System status: ${metrics.alerts.filter(a => a.severity === 'error').length === 0 ? 'HEALTHY' : 'DEGRADED'}`, 
        metrics.alerts.filter(a => a.severity === 'error').length === 0 ? colors.green : colors.red);
  }

  getUptime() {
    if (!this.startTime) {
      this.startTime = new Date();
      return '0s';
    }
    
    const uptime = Date.now() - this.startTime.getTime();
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / (1000 * 60)) % 60;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  async saveMetricsHistory(metrics) {
    try {
      // Save to history file
      const historyEntry = {
        timestamp: metrics.timestamp,
        metrics: {
          memory_efficiency: metrics.system_health.memory_efficiency,
          total_prompts: metrics.database_health.total_prompts,
          avg_query_time: metrics.database_health.avg_query_time,
          classification_accuracy: metrics.performance_metrics.classification_accuracy,
          intent_extraction_precision: metrics.performance_metrics.intent_extraction_precision,
          similarity_detection_recall: metrics.performance_metrics.similarity_detection_recall
        },
        alerts_count: metrics.alerts.length,
        error_alerts_count: metrics.alerts.filter(a => a.severity === 'error').length
      };

      // Read existing history
      let history = [];
      try {
        const fs = await import('fs/promises');
        const existingData = await fs.readFile('prp-monitoring-history.json', 'utf8');
        history = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist yet, start with empty history
      }

      // Add new entry and keep only last 1000 entries
      history.push(historyEntry);
      history = history.slice(-1000);

      // Save updated history
      const fs = await import('fs/promises');
      await fs.writeFile('prp-monitoring-history.json', JSON.stringify(history, null, 2));

      // Also save current snapshot
      await fs.writeFile('prp-monitoring-current.json', JSON.stringify(metrics, null, 2));

    } catch (error) {
      logError(`Failed to save metrics history: ${error.message}`);
    }
  }

  async startMonitoring(intervalSeconds = 30) {
    logInfo(`Starting real-time monitoring (${intervalSeconds}s intervals)...`);
    
    this.startTime = new Date();
    
    const monitor = async () => {
      try {
        const metrics = await this.collectRealTimeMetrics();
        
        // Add new alerts to history
        if (metrics.alerts) {
          this.alertHistory.push(...metrics.alerts);
          // Keep only last 100 alerts
          this.alertHistory = this.alertHistory.slice(-100);
        }
        
        this.displayMetrics(metrics);
        await this.saveMetricsHistory(metrics);
        
      } catch (error) {
        logError(`Monitoring cycle failed: ${error.message}`);
      }
    };

    // Initial monitoring cycle
    await monitor();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(monitor, intervalSeconds * 1000);

    logInfo("Press Ctrl+C to stop monitoring");
  }

  async stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.memoryStore) {
      await this.memoryStore.close();
    }

    logInfo("Monitoring stopped");
  }
}

/**
 * Main monitoring function
 */
async function startMonitoring() {
  const args = process.argv.slice(2);
  let intervalSeconds = 30;
  
  // Parse interval argument
  for (const arg of args) {
    if (arg.startsWith('--interval=')) {
      intervalSeconds = parseInt(arg.split('=')[1]);
      if (intervalSeconds < 5) {
        console.error('Error: Minimum interval is 5 seconds');
        process.exit(1);
      }
    }
  }

  const monitor = new PRPMonitoringSystem();
  
  try {
    await monitor.initialize();
    await monitor.startMonitoring(intervalSeconds);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down monitoring system...');
      await monitor.stopMonitoring();
      process.exit(0);
    });
    
  } catch (error) {
    logError(`Monitoring system failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run monitoring if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMonitoring().catch(error => {
    console.error('Monitoring system startup failed:', error);
    process.exit(1);
  });
}

export { PRPMonitoringSystem, startMonitoring };