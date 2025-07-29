#!/usr/bin/env node
/**
 * @fileoverview Advanced Database Analytics and Migration CLI
 * 
 * Interactive command-line interface for PostgreSQL database analytics,
 * migration management, and cognitive insights analysis.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { PostgreSQLMemoryStore } from '../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../src/memory/postgresql-config.js';

// CLI Configuration
const ANALYTICS_DIR = './analytics-reports';
const EXPORT_DIR = './data-exports';

// Ensure directories exist
if (!existsSync(ANALYTICS_DIR)) {
  mkdirSync(ANALYTICS_DIR, { recursive: true });
}
if (!existsSync(EXPORT_DIR)) {
  mkdirSync(EXPORT_DIR, { recursive: true });
}

/**
 * Initialize PostgreSQL connection
 */
async function initializeStore() {
  try {
    const config = PostgreSQLConfigs.fromEnvironment();
    const store = new PostgreSQLMemoryStore(config);
    await store.initialize();
    return store;
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    console.error('Make sure the database is running and environment variables are set.');
    process.exit(1);
  }
}

/**
 * Generate comprehensive cognitive analytics report
 */
async function generateAnalyticsReport(store, options = {}) {
  const reportId = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `${ANALYTICS_DIR}/cognitive-analytics-${reportId}.json`;
  
  console.log('📊 Generating comprehensive cognitive analytics report...');
  console.log(`Report will be saved to: ${reportFile}`);
  
  const report = {
    generated_at: new Date().toISOString(),
    report_id: reportId,
    system_info: {
      database_type: 'PostgreSQL with TimescaleDB',
      extensions: await getAvailableExtensions(store),
    },
    analytics: {},
  };

  try {
    // Basic statistics
    console.log('📈 Collecting basic statistics...');
    report.analytics.basic_stats = await store.getStats();

    // Cognitive performance trends
    console.log('🧠 Analyzing cognitive performance trends...');
    report.analytics.performance_trends = await store.getCognitivePerformanceTrend(
      options.daysBack || 30,
      options.domain
    );

    // Pattern effectiveness analysis
    console.log('🔍 Analyzing pattern effectiveness...');
    report.analytics.pattern_effectiveness = await store.analyzePatternEffectiveness(
      options.daysBack || 60
    );

    // Cognitive load alerts
    console.log('⚠️ Checking cognitive load alerts...');
    report.analytics.load_alerts = await store.getCognitiveLoadAlerts(
      options.hoursBack || 24
    );

    // Real-time metrics
    console.log('⏱️ Collecting real-time metrics...');
    report.analytics.realtime_metrics = await store.getCognitiveMetricsRealtime(2);

    // Semantic clustering (if available)
    if (report.system_info.extensions.includes('vector')) {
      console.log('🎯 Performing semantic clustering analysis...');
      report.analytics.semantic_clusters = await store.clusterThoughtsSemantic(0.8, 3);
    }

    // Top domains analysis
    console.log('🏷️ Analyzing domain distribution...');
    report.analytics.domain_analysis = await analyzeDomainDistribution(store);

    // Success rate analysis
    console.log('📊 Calculating success rates...');
    report.analytics.success_analysis = await analyzeSuccessRates(store);

    // Save report
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`✅ Analytics report generated successfully: ${reportFile}`);

    // Display summary
    displayAnalyticsSummary(report);

    return reportFile;
  } catch (error) {
    console.error('❌ Error generating analytics report:', error);
    throw error;
  }
}

/**
 * Get available database extensions
 */
async function getAvailableExtensions(store) {
  try {
    const result = await store.query('SELECT extname FROM pg_extension ORDER BY extname');
    return result.rows.map(row => row.extname);
  } catch (error) {
    console.warn('Could not fetch extensions:', error.message);
    return [];
  }
}

/**
 * Analyze domain distribution
 */
async function analyzeDomainDistribution(store) {
  try {
    const result = await store.query(`
      SELECT 
        domain,
        COUNT(*) as thought_count,
        AVG(confidence) as avg_confidence,
        AVG(effectiveness_score) as avg_effectiveness,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_thoughts
      FROM stored_thoughts 
      WHERE domain IS NOT NULL
      GROUP BY domain 
      ORDER BY thought_count DESC
      LIMIT 20
    `);
    return result.rows;
  } catch (error) {
    console.warn('Could not analyze domain distribution:', error.message);
    return [];
  }
}

/**
 * Analyze success rates by various dimensions
 */
async function analyzeSuccessRates(store) {
  try {
    const queries = {
      by_confidence_range: `
        SELECT 
          CASE 
            WHEN confidence < 0.3 THEN 'Low (0-0.3)'
            WHEN confidence < 0.6 THEN 'Medium (0.3-0.6)'
            WHEN confidence < 0.8 THEN 'High (0.6-0.8)'
            ELSE 'Very High (0.8-1.0)'
          END as confidence_range,
          COUNT(*) as total_thoughts,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_thoughts,
          ROUND(
            COUNT(CASE WHEN success = true THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(CASE WHEN success IS NOT NULL THEN 1 END), 0) * 100, 2
          ) as success_percentage
        FROM stored_thoughts 
        WHERE success IS NOT NULL
        GROUP BY confidence_range
        ORDER BY confidence_range
      `,
      by_complexity_range: `
        SELECT 
          CASE 
            WHEN complexity < 3 THEN 'Simple (1-3)'
            WHEN complexity < 6 THEN 'Medium (3-6)' 
            WHEN complexity < 8 THEN 'Complex (6-8)'
            ELSE 'Very Complex (8-10)'
          END as complexity_range,
          COUNT(*) as total_thoughts,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_thoughts,
          ROUND(
            COUNT(CASE WHEN success = true THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(CASE WHEN success IS NOT NULL THEN 1 END), 0) * 100, 2
          ) as success_percentage
        FROM stored_thoughts 
        WHERE success IS NOT NULL AND complexity IS NOT NULL
        GROUP BY complexity_range
        ORDER BY complexity_range
      `,
    };

    const analysis = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await store.query(query);
      analysis[key] = result.rows;
    }

    return analysis;
  } catch (error) {
    console.warn('Could not analyze success rates:', error.message);
    return {};
  }
}

/**
 * Display analytics summary in console
 */
function displayAnalyticsSummary(report) {
  console.log('\n📋 Analytics Summary:');
  console.log('='.repeat(60));
  
  const stats = report.analytics.basic_stats;
  if (stats) {
    console.log(`Total Thoughts: ${stats.total_thoughts.toLocaleString()}`);
    console.log(`Total Sessions: ${stats.total_sessions.toLocaleString()}`);
    console.log(`Success Rate: ${(stats.overall_success_rate * 100).toFixed(1)}%`);
    console.log(`Average Confidence: ${stats.average_confidence?.toFixed(3) || 'N/A'}`);
  }

  const trends = report.analytics.performance_trends;
  if (trends && trends.length > 0) {
    console.log(`\n📈 Recent Performance (last ${trends.length} days):`);
    const recent = trends.slice(0, 3);
    recent.forEach(day => {
      console.log(`   ${day.day}: ${day.thought_count} thoughts, ${(day.success_rate * 100).toFixed(1)}% success`);
    });
  }

  const alerts = report.analytics.load_alerts;
  if (alerts && alerts.length > 0) {
    console.log(`\n⚠️  Active Cognitive Load Alerts: ${alerts.length}`);
    alerts.slice(0, 3).forEach(alert => {
      console.log(`   ${alert.severity}: ${alert.description}`);
    });
  }

  const clusters = report.analytics.semantic_clusters;
  if (clusters && clusters.length > 0) {
    console.log(`\n🎯 Semantic Clusters Found: ${clusters.length}`);
    console.log(`   Largest cluster: ${clusters[0]?.cluster_size || 0} thoughts`);
  }
}

/**
 * Interactive data migration tools
 */
async function runMigrationWizard(store) {
  console.log('🔄 Database Migration Wizard');
  console.log('='.repeat(40));
  
  const migrations = [
    {
      name: 'Update Search Vectors',
      description: 'Update full-text search vectors for existing data',
      query: 'SELECT update_search_vectors()',
    },
    {
      name: 'Update Pattern Embeddings', 
      description: 'Refresh pattern embeddings based on current data',
      query: 'SELECT update_pattern_embeddings()',
    },
    {
      name: 'Optimize Storage',
      description: 'Run VACUUM and ANALYZE on all tables',
      action: async () => await store.optimize(),
    },
    {
      name: 'Refresh Analytics Views',
      description: 'Manually refresh continuous aggregates',
      queries: [
        "CALL refresh_continuous_aggregate('cognitive_metrics_hourly', NULL, NULL)",
        "CALL refresh_continuous_aggregate('session_metrics_daily', NULL, NULL)",
        "CALL refresh_continuous_aggregate('cognitive_load_realtime', NULL, NULL)",
      ],
    },
  ];

  for (const migration of migrations) {
    try {
      console.log(`\n🔧 Running: ${migration.name}`);
      console.log(`   ${migration.description}`);
      
      if (migration.action) {
        await migration.action();
      } else if (migration.query) {
        const result = await store.query(migration.query);
        if (result.rows[0]) {
          console.log(`   ✅ Result: ${Object.values(result.rows[0])[0]}`);
        }
      } else if (migration.queries) {
        for (const query of migration.queries) {
          try {
            await store.query(query);
            console.log(`   ✅ Executed: ${query.split('(')[0]}(...)`);
          } catch (error) {
            console.log(`   ⏭️ Skipped: ${query.split('(')[0]}(...) - ${error.message}`);
          }
        }
      }
      
      console.log(`   ✅ ${migration.name} completed`);
    } catch (error) {
      console.log(`   ❌ ${migration.name} failed: ${error.message}`);
    }
  }
  
  console.log('\n✅ Migration wizard completed');
}

/**
 * Export data in various formats
 */
async function exportData(store, format, options = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${EXPORT_DIR}/cognitive-data-${timestamp}.${format}`;
  
  console.log(`📤 Exporting data in ${format.toUpperCase()} format...`);
  console.log(`Export file: ${filename}`);
  
  try {
    if (options.streaming) {
      console.log('🌊 Using streaming export for large datasets...');
      await streamingExport(store, filename, format, options);
    } else {
      const data = await store.exportData(format, options.limit);
      writeFileSync(filename, data);
    }
    
    console.log(`✅ Data exported successfully: ${filename}`);
    return filename;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
}

/**
 * Streaming export for large datasets
 */
async function streamingExport(store, filename, format, options) {
  const fs = await import('fs');
  const stream = fs.createWriteStream(filename);
  
  let totalThoughts = 0;
  let totalSessions = 0;
  
  // Export thoughts in batches
  console.log('📝 Exporting thoughts...');
  for await (const batch of store.streamExportThoughts(options.batchSize || 1000)) {
    totalThoughts += batch.length;
    
    if (format === 'jsonl') {
      for (const thought of batch) {
        stream.write(JSON.stringify(thought) + '\n');
      }
    }
    
    // Progress indicator
    if (totalThoughts % 10000 === 0) {
      console.log(`   📊 Exported ${totalThoughts.toLocaleString()} thoughts...`);
    }
  }
  
  // Export sessions in batches
  console.log('📋 Exporting sessions...');
  for await (const batch of store.streamExportSessions(options.batchSize || 1000)) {
    totalSessions += batch.length;
    
    if (format === 'jsonl') {
      for (const session of batch) {
        stream.write(JSON.stringify({ type: 'session', ...session }) + '\n');
      }
    }
    
    // Progress indicator
    if (totalSessions % 1000 === 0) {
      console.log(`   📊 Exported ${totalSessions.toLocaleString()} sessions...`);
    }  
  }
  
  stream.end();
  console.log(`📊 Streaming export completed: ${totalThoughts.toLocaleString()} thoughts, ${totalSessions.toLocaleString()} sessions`);
}

/**
 * Interactive search and analysis
 */
async function runInteractiveSearch(store) {
  console.log('🔍 Interactive Search & Analysis');
  console.log('='.repeat(40));
  
  const searchTypes = [
    'Hybrid Search (text + semantic)',
    'Semantic Similarity Search', 
    'Full-Text Search',
    'Pattern Analysis',
    'Domain Analysis',
  ];
  
  console.log('Available search types:');
  searchTypes.forEach((type, index) => {
    console.log(`${index + 1}. ${type}`);
  });
  
  // For demo purposes, run a sample of each search type
  console.log('\n🎯 Running sample searches...');
  
  // Sample hybrid search
  try {
    console.log('\n1. Sample Hybrid Search: "debugging memory leaks"');
    const hybridResults = await store.hybridSearchThoughts('debugging memory leaks', null, 0.5, 0.5, 5);
    console.log(`   Found ${hybridResults.length} results`);
    if (hybridResults.length > 0) {
      console.log(`   Top result: "${hybridResults[0].thought_text?.substring(0, 100)}..."`);
    }
  } catch (error) {
    console.log(`   ⏭️ Hybrid search not available: ${error.message}`);
  }
  
  // Sample pattern analysis
  try {
    console.log('\n2. Pattern Effectiveness Analysis (last 30 days)');
    const patterns = await store.analyzePatternEffectiveness(30);
    console.log(`   Found ${patterns.length} patterns`);
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      console.log(`   Most effective: "${topPattern.pattern}" (${topPattern.frequency} occurrences, ${(topPattern.success_rate * 100).toFixed(1)}% success)`);
    }
  } catch (error) {
    console.log(`   ⏭️ Pattern analysis not available: ${error.message}`);
  }
  
  // Sample clustering
  try {
    console.log('\n3. Semantic Clustering Analysis');
    const clusters = await store.clusterThoughtsSemantic(0.8, 3);
    console.log(`   Found ${clusters.length} semantic clusters`);
    if (clusters.length > 0) {
      const largestCluster = clusters[0];
      console.log(`   Largest cluster: ${largestCluster.cluster_size} thoughts with ${(largestCluster.avg_confidence * 100).toFixed(1)}% avg confidence`);
    }
  } catch (error) {
    console.log(`   ⏭️ Semantic clustering not available: ${error.message}`);
  }
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    showHelp();
    return;
  }
  
  const store = await initializeStore();
  
  try {
    switch (command) {
      case 'analytics':
      case 'report':
        const options = {
          daysBack: parseInt(args[1]) || 30,
          domain: args[2] || null,
          hoursBack: parseInt(args[3]) || 24,
        };
        await generateAnalyticsReport(store, options);
        break;
        
      case 'migrate':
      case 'migration':
        await runMigrationWizard(store);
        break;
        
      case 'export':
        const format = args[1] || 'json';
        const exportOptions = {
          limit: parseInt(args[2]) || undefined,
          streaming: args.includes('--stream'),
          batchSize: parseInt(args.find(arg => arg.startsWith('--batch='))?.split('=')[1]) || 1000,
        };
        await exportData(store, format, exportOptions);
        break;
        
      case 'search':
      case 'interactive':
        await runInteractiveSearch(store);
        break;
        
      case 'health':
      case 'status':
        await checkDatabaseHealth(store);
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } finally {
    await store.close();
  }
}

/**
 * Check database health and capabilities
 */
async function checkDatabaseHealth(store) {
  console.log('🏥 Database Health Check');
  console.log('='.repeat(30));
  
  try {
    // Basic connectivity
    const timeResult = await store.query('SELECT NOW() as current_time');
    console.log(`✅ Database connectivity: OK (${timeResult.rows[0].current_time})`);
    
    // Extensions check
    const extensions = await getAvailableExtensions(store);
    console.log(`✅ Available extensions: ${extensions.join(', ')}`);
    
    // Table sizes
    const sizeResult = await store.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY size_bytes DESC
    `);
    
    console.log('\n📊 Table Sizes:');
    sizeResult.rows.forEach(row => {
      console.log(`   ${row.tablename}: ${row.size}`);
    });
    
    // Statistics
    const stats = await store.getStats();
    console.log(`\n📈 Data Statistics:`);
    console.log(`   Total thoughts: ${stats.total_thoughts.toLocaleString()}`);
    console.log(`   Total sessions: ${stats.total_sessions.toLocaleString()}`);
    console.log(`   Average confidence: ${stats.average_confidence?.toFixed(3) || 'N/A'}`);
    console.log(`   Success rate: ${(stats.overall_success_rate * 100).toFixed(1)}%`);
    
    // Feature availability
    console.log(`\n🔧 Feature Availability:`);
    const features = [
      { name: 'TimescaleDB', available: extensions.includes('timescaledb') },
      { name: 'pgvector (Semantic Search)', available: extensions.includes('vector') },
      { name: 'pg_trgm (Text Similarity)', available: extensions.includes('pg_trgm') },
      { name: 'Full-Text Search', available: true },
    ];
    
    features.forEach(feature => {
      const status = feature.available ? '✅' : '❌';
      console.log(`   ${status} ${feature.name}`);
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log('\n🧠 Sentient AGI Database Analytics CLI');
  console.log('='.repeat(50));
  console.log('\nCommands:');
  console.log('  analytics [days] [domain] [hours]  Generate comprehensive analytics report');
  console.log('  migrate                            Run database migration wizard');
  console.log('  export <format> [limit] [--stream] Export data (json, csv, jsonl)');
  console.log('  search                             Interactive search and analysis');
  console.log('  health                             Check database health and capabilities');
  console.log('  help                               Show this help message');
  console.log('\nExamples:');
  console.log('  ./db-analytics.js analytics 30 software_development');
  console.log('  ./db-analytics.js export jsonl --stream --batch=5000');
  console.log('  ./db-analytics.js migrate');
  console.log('  ./db-analytics.js search');
  console.log('\nEnvironment Variables:');
  console.log('  MEMORY_STORE_TYPE=postgresql');
  console.log('  POSTGRES_HOST=localhost'); 
  console.log('  POSTGRES_PORT=5432');
  console.log('  POSTGRES_DB=map_think_do');
  console.log('  POSTGRES_USER=mtd_user');
  console.log('  POSTGRES_PASSWORD=p4ssw0rd');
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ CLI execution failed:', error);
    process.exit(1);
  });
}