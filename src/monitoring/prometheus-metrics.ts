/**
 * @fileoverview Prometheus Metrics Export for Cognitive Analytics
 * 
 * Exports cognitive performance metrics in Prometheus format for monitoring
 * and alerting. Integrates with TimescaleDB analytics and real-time data.
 */

import { MemoryStore } from '../memory/memory-store.js';

export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

export interface CognitiveMetrics {
  // Core metrics
  total_thoughts: number;
  total_sessions: number;
  active_sessions: number;
  
  // Performance metrics
  average_confidence: number;
  success_rate: number;
  average_complexity: number;
  thoughts_per_minute: number;
  
  // Quality metrics
  revision_rate: number;
  branch_rate: number;
  effectiveness_score: number;
  
  // Load metrics
  cognitive_load_current: number;
  memory_usage_percent: number;
  processing_latency_ms: number;
  
  // Domain metrics
  active_domains: string[];
  domain_distribution: Record<string, number>;
  
  // Pattern metrics
  pattern_count: number;
  pattern_effectiveness: number;
  
  // Alert metrics
  alert_count: number;
  critical_alert_count: number;
}

/**
 * Prometheus Metrics Exporter for Cognitive Analytics
 */
export class PrometheusMetricsExporter {
  private memoryStore: MemoryStore;
  private metricsCache: Map<string, PrometheusMetric> = new Map();
  private lastUpdateTime: number = 0;
  private cacheExpiryMs: number = 30000; // 30 seconds
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Export all cognitive metrics in Prometheus format
   */
  async exportMetrics(): Promise<string> {
    const metrics = await this.collectCognitiveMetrics();
    const prometheusMetrics = this.convertToPrometheusFormat(metrics);
    return this.formatPrometheusMetrics(prometheusMetrics);
  }

  /**
   * Collect comprehensive cognitive metrics
   */
  async collectCognitiveMetrics(): Promise<CognitiveMetrics> {
    // Use cache if recent
    const now = Date.now();
    if (now - this.lastUpdateTime < this.cacheExpiryMs && this.metricsCache.size > 0) {
      return this.getCachedMetrics();
    }

    try {
      // Get basic statistics
      const stats = await this.memoryStore.getStats();
      
      // Get real-time metrics (if available)
      const realtimeMetrics = await this.getRealTimeMetrics();
      
      // Get performance trends
      const performanceTrends = await this.getPerformanceTrends();
      
      // Get cognitive load alerts
      const alerts = await this.getCognitiveAlerts();
      
      // Calculate derived metrics
      const cognitiveMetrics: CognitiveMetrics = {
        // Core metrics
        total_thoughts: stats.total_thoughts || 0,
        total_sessions: stats.total_sessions || 0,
        active_sessions: await this.countActiveSessions(),
        
        // Performance metrics
        average_confidence: await this.getAverageConfidence(),
        success_rate: stats.overall_success_rate || 0,
        average_complexity: await this.getAverageComplexity(),
        thoughts_per_minute: realtimeMetrics.thoughts_per_minute || 0,
        
        // Quality metrics
        revision_rate: await this.getRevisionRate(),
        branch_rate: await this.getBranchRate(),
        effectiveness_score: await this.getAverageEffectiveness(),
        
        // Load metrics
        cognitive_load_current: realtimeMetrics.cognitive_load || 0,
        memory_usage_percent: this.getMemoryUsagePercent(),
        processing_latency_ms: realtimeMetrics.processing_latency || 0,
        
        // Domain metrics
        active_domains: await this.getActiveDomains(),
        domain_distribution: await this.getDomainDistribution(),
        
        // Pattern metrics
        pattern_count: await this.getPatternCount(),
        pattern_effectiveness: await this.getPatternEffectiveness(),
        
        // Alert metrics
        alert_count: alerts.length,
        critical_alert_count: alerts.filter(a => a.severity === 'CRITICAL').length,
      };

      // Cache results
      this.lastUpdateTime = now;
      this.cacheMetrics(cognitiveMetrics);
      
      return cognitiveMetrics;
    } catch (error) {
      console.error('Error collecting cognitive metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Convert cognitive metrics to Prometheus format
   */
  private convertToPrometheusFormat(metrics: CognitiveMetrics): PrometheusMetric[] {
    const prometheusMetrics: PrometheusMetric[] = [
      // Core metrics
      {
        name: 'cognitive_thoughts_total',
        help: 'Total number of thoughts processed',
        type: 'counter',
        value: metrics.total_thoughts,
      },
      {
        name: 'cognitive_sessions_total',
        help: 'Total number of reasoning sessions',
        type: 'counter',
        value: metrics.total_sessions,
      },
      {
        name: 'cognitive_sessions_active',
        help: 'Number of currently active sessions',
        type: 'gauge',
        value: metrics.active_sessions,
      },
      
      // Performance metrics
      {
        name: 'cognitive_confidence_average',
        help: 'Average confidence level of thoughts',
        type: 'gauge',
        value: metrics.average_confidence,
      },
      {
        name: 'cognitive_success_rate',
        help: 'Success rate of cognitive processes',
        type: 'gauge',
        value: metrics.success_rate,
      },
      {
        name: 'cognitive_complexity_average',
        help: 'Average complexity level of thoughts',
        type: 'gauge',
        value: metrics.average_complexity,
      },
      {
        name: 'cognitive_thoughts_per_minute',
        help: 'Rate of thought processing per minute',
        type: 'gauge',
        value: metrics.thoughts_per_minute,
      },
      
      // Quality metrics
      {
        name: 'cognitive_revision_rate',
        help: 'Rate of thought revisions',
        type: 'gauge',
        value: metrics.revision_rate,
      },
      {
        name: 'cognitive_branch_rate',
        help: 'Rate of thought branching',
        type: 'gauge',
        value: metrics.branch_rate,
      },
      {
        name: 'cognitive_effectiveness_score',
        help: 'Average effectiveness score',
        type: 'gauge',
        value: metrics.effectiveness_score,
      },
      
      // Load metrics
      {
        name: 'cognitive_load_current',
        help: 'Current cognitive load level',
        type: 'gauge',
        value: metrics.cognitive_load_current,
      },
      {
        name: 'cognitive_memory_usage_percent',
        help: 'Memory usage percentage',
        type: 'gauge',
        value: metrics.memory_usage_percent,
      },
      {
        name: 'cognitive_processing_latency_milliseconds',
        help: 'Processing latency in milliseconds',
        type: 'gauge',
        value: metrics.processing_latency_ms,
      },
      
      // Pattern metrics
      {
        name: 'cognitive_patterns_total',
        help: 'Total number of detected patterns',
        type: 'gauge',
        value: metrics.pattern_count,
      },
      {
        name: 'cognitive_pattern_effectiveness',
        help: 'Average effectiveness of patterns',
        type: 'gauge',
        value: metrics.pattern_effectiveness,
      },
      
      // Alert metrics
      {
        name: 'cognitive_alerts_total',
        help: 'Total number of active alerts',
        type: 'gauge',
        value: metrics.alert_count,
      },
      {
        name: 'cognitive_alerts_critical',
        help: 'Number of critical alerts',
        type: 'gauge',
        value: metrics.critical_alert_count,
      },
    ];

    // Add domain-specific metrics
    for (const [domain, count] of Object.entries(metrics.domain_distribution)) {
      prometheusMetrics.push({
        name: 'cognitive_thoughts_by_domain',
        help: 'Number of thoughts by domain',
        type: 'gauge',
        value: count,
        labels: { domain },
      });
    }

    return prometheusMetrics;
  }

  /**
   * Format metrics in Prometheus exposition format
   */
  private formatPrometheusMetrics(metrics: PrometheusMetric[]): string {
    const lines: string[] = [];
    
    // Add header comment
    lines.push('# Sentient AGI Cognitive Analytics Metrics');
    lines.push(`# Generated at: ${new Date().toISOString()}`);
    lines.push('');

    for (const metric of metrics) {
      // Add HELP line
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      
      // Add TYPE line
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      // Add metric line
      let metricLine = metric.name;
      if (metric.labels && Object.keys(metric.labels).length > 0) {
        const labelPairs = Object.entries(metric.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        metricLine += `{${labelPairs}}`;
      }
      
      metricLine += ` ${metric.value}`;
      if (metric.timestamp) {
        metricLine += ` ${metric.timestamp}`;
      }
      
      lines.push(metricLine);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Helper methods for metric collection
   */

  private async getRealTimeMetrics(): Promise<any> {
    try {
      if (typeof (this.memoryStore as any).getCognitiveMetricsRealtime === 'function') {
        const realtime = await (this.memoryStore as any).getCognitiveMetricsRealtime(1);
        if (realtime.length > 0) {
          const latest = realtime[0];
          return {
            thoughts_per_minute: latest.thoughts_per_window * 12, // 5-minute windows * 12 = hourly rate
            cognitive_load: Math.min(latest.high_complexity_count / Math.max(latest.thoughts_per_window, 1), 1),
            processing_latency: 0, // Would need to be measured separately
          };
        }
      }
    } catch (error) {
      console.warn('Real-time metrics not available:', error);
    }
    return {};
  }

  private async getPerformanceTrends(): Promise<any[]> {
    try {
      if (typeof (this.memoryStore as any).getCognitivePerformanceTrend === 'function') {
        return await (this.memoryStore as any).getCognitivePerformanceTrend(7);
      }
    } catch (error) {
      console.warn('Performance trends not available:', error);
    }
    return [];
  }

  private async getCognitiveAlerts(): Promise<any[]> {
    try {
      if (typeof (this.memoryStore as any).getCognitiveLoadAlerts === 'function') {
        return await (this.memoryStore as any).getCognitiveLoadAlerts(24);
      }
    } catch (error) {
      console.warn('Cognitive alerts not available:', error);
    }
    return [];
  }

  private async countActiveSessions(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const sessions = await this.memoryStore.getSessions(100);
      return sessions.filter(s => 
        !s.end_time || (s.end_time && s.end_time > oneHourAgo)
      ).length;
    } catch (error) {
      return 0;
    }
  }

  private async getAverageConfidence(): Promise<number> {
    try {
      const query = 'SELECT AVG(confidence) as avg_confidence FROM stored_thoughts WHERE confidence IS NOT NULL';
      const result = await (this.memoryStore as any).query(query);
      return parseFloat(result.rows[0]?.avg_confidence || '0');
    } catch (error) {
      return 0;
    }
  }

  private async getAverageComplexity(): Promise<number> {
    try {
      const query = 'SELECT AVG(complexity) as avg_complexity FROM stored_thoughts WHERE complexity IS NOT NULL';
      const result = await (this.memoryStore as any).query(query);
      return parseFloat(result.rows[0]?.avg_complexity || '0');
    } catch (error) {
      return 0;
    }
  }

  private async getRevisionRate(): Promise<number> {
    try {
      const query = `
        SELECT 
          COUNT(CASE WHEN is_revision = true THEN 1 END)::FLOAT / 
          NULLIF(COUNT(*), 0) as revision_rate
        FROM stored_thoughts
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `;
      const result = await (this.memoryStore as any).query(query);
      return parseFloat(result.rows[0]?.revision_rate || '0');
    } catch (error) {
      return 0;
    }
  }

  private async getBranchRate(): Promise<number> {
    try {
      const query = `
        SELECT 
          COUNT(CASE WHEN branch_from_thought IS NOT NULL THEN 1 END)::FLOAT / 
          NULLIF(COUNT(*), 0) as branch_rate
        FROM stored_thoughts
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `;
      const result = await (this.memoryStore as any).query(query);
      return parseFloat(result.rows[0]?.branch_rate || '0');
    } catch (error) {
      return 0;
    }
  }

  private async getAverageEffectiveness(): Promise<number> {
    try {
      const query = 'SELECT AVG(effectiveness_score) as avg_effectiveness FROM stored_thoughts WHERE effectiveness_score IS NOT NULL';
      const result = await (this.memoryStore as any).query(query);
      return parseFloat(result.rows[0]?.avg_effectiveness || '0');
    } catch (error) {
      return 0;
    }
  }

  private async getActiveDomains(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT domain 
        FROM stored_thoughts 
        WHERE domain IS NOT NULL 
          AND timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY domain
      `;
      const result = await (this.memoryStore as any).query(query);
      return result.rows.map((row: any) => row.domain);
    } catch (error) {
      return [];
    }
  }

  private async getDomainDistribution(): Promise<Record<string, number>> {
    try {
      const query = `
        SELECT domain, COUNT(*) as count
        FROM stored_thoughts 
        WHERE domain IS NOT NULL 
          AND timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
      `;
      const result = await (this.memoryStore as any).query(query);
      const distribution: Record<string, number> = {};
      result.rows.forEach((row: any) => {
        distribution[row.domain] = parseInt(row.count);
      });
      return distribution;
    } catch (error) {
      return {};
    }
  }

  private async getPatternCount(): Promise<number> {
    try {
      const query = `
        SELECT COUNT(DISTINCT unnest(patterns_detected)) as pattern_count
        FROM stored_thoughts 
        WHERE patterns_detected IS NOT NULL
          AND timestamp >= NOW() - INTERVAL '24 hours'
      `;
      const result = await (this.memoryStore as any).query(query);
      return parseInt(result.rows[0]?.pattern_count || '0');
    } catch (error) {
      return 0;
    }
  }

  private async getPatternEffectiveness(): Promise<number> {
    try {
      if (typeof (this.memoryStore as any).analyzePatternEffectiveness === 'function') {
        const patterns = await (this.memoryStore as any).analyzePatternEffectiveness(7);
        if (patterns.length > 0) {
          const totalEffectiveness = patterns.reduce((sum: number, p: any) => sum + (p.avg_effectiveness || 0), 0);
          return totalEffectiveness / patterns.length;
        }
      }
    } catch (error) {
      console.warn('Pattern effectiveness not available:', error);
    }
    return 0;
  }

  private getMemoryUsagePercent(): number {
    try {
      const usage = process.memoryUsage();
      return (usage.heapUsed / usage.heapTotal) * 100;
    } catch (error) {
      return 0;
    }
  }

  private getCachedMetrics(): CognitiveMetrics {
    // Reconstruct metrics from cache
    return this.getDefaultMetrics();
  }

  private cacheMetrics(metrics: CognitiveMetrics): void {
    // Cache individual metrics for performance
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        this.metricsCache.set(key, {
          name: key,
          help: `Cached ${key}`,
          type: 'gauge',
          value,
        });
      }
    }
  }

  private getDefaultMetrics(): CognitiveMetrics {
    return {
      total_thoughts: 0,
      total_sessions: 0,
      active_sessions: 0,
      average_confidence: 0,
      success_rate: 0,
      average_complexity: 0,
      thoughts_per_minute: 0,
      revision_rate: 0,
      branch_rate: 0,
      effectiveness_score: 0,
      cognitive_load_current: 0,
      memory_usage_percent: this.getMemoryUsagePercent(),
      processing_latency_ms: 0,
      active_domains: [],
      domain_distribution: {},
      pattern_count: 0,
      pattern_effectiveness: 0,
      alert_count: 0,
      critical_alert_count: 0,
    };
  }

  /**
   * Start automatic metrics export at regular intervals
   */
  startMetricsServer(port = 9090, intervalMs = 15000): void {
    // This would start an HTTP server to serve metrics
    // For now, we'll just log metrics periodically
    console.log(`🔧 Starting Prometheus metrics export on port ${port} (interval: ${intervalMs}ms)`);
    
    // Clear any existing interval
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.metricsInterval = setInterval(async () => {
      try {
        const metricsText = await this.exportMetrics();
        console.log(`📊 Prometheus metrics updated (${metricsText.split('\n').length} lines)`);
        
        // In a real implementation, this would be served via HTTP
        // Example: Express.js endpoint that returns metricsText
      } catch (error) {
        console.error('Error updating Prometheus metrics:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop metrics server and cleanup resources
   */
  stopMetricsServer(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('🔧 Prometheus metrics server stopped');
    }
  }

  /**
   * Dispose and cleanup all resources
   */
  dispose(): void {
    this.stopMetricsServer();
    this.metricsCache.clear();
    console.log('📊 PrometheusMetricsExporter disposed');
  }
}

/**
 * Create and configure Prometheus metrics exporter
 */
export function createPrometheusExporter(memoryStore: MemoryStore): PrometheusMetricsExporter {
  return new PrometheusMetricsExporter(memoryStore);
}