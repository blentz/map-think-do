#!/usr/bin/env node

/**
 * Generate an actual database report from PostgreSQL data
 * This demonstrates that the system works end-to-end with real data
 */

import { PostgreSQLMemoryStore } from './dist/src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './dist/src/memory/postgresql-config.js';

async function generateDatabaseReport() {
  console.log('📊 Generating PostgreSQL Memory Store Database Report');
  console.log('='.repeat(60));

  const store = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
  await store.initialize();

  try {
    // 1. Basic Statistics
    console.log('\n📈 BASIC STATISTICS');
    console.log('-'.repeat(40));

    const basicStats = await store.query(`
      SELECT 
        (SELECT COUNT(*) FROM reasoning_sessions) as total_sessions,
        (SELECT COUNT(*) FROM stored_thoughts) as total_thoughts,
        (SELECT COUNT(DISTINCT session_id) FROM stored_thoughts) as sessions_with_thoughts,
        (SELECT ROUND(AVG(total_thoughts), 2) FROM reasoning_sessions) as avg_thoughts_per_session,
        (SELECT MIN(start_time) FROM reasoning_sessions) as earliest_session,
        (SELECT MAX(start_time) FROM reasoning_sessions) as latest_session
    `);

    const stats = basicStats.rows[0];
    console.log(`Total Sessions: ${stats.total_sessions}`);
    console.log(`Total Thoughts: ${stats.total_thoughts}`);
    console.log(`Sessions with Thoughts: ${stats.sessions_with_thoughts}`);
    console.log(`Average Thoughts per Session: ${stats.avg_thoughts_per_session || 0}`);
    console.log(
      `Date Range: ${stats.earliest_session || 'N/A'} to ${stats.latest_session || 'N/A'}`
    );

    // 2. Domain Analysis
    console.log('\n🎯 DOMAIN ANALYSIS');
    console.log('-'.repeat(40));

    const domainStats = await store.query(`
      SELECT 
        domain,
        COUNT(*) as thought_count,
        COUNT(DISTINCT session_id) as unique_sessions,
        ROUND(AVG(confidence), 3) as avg_confidence
      FROM stored_thoughts 
      WHERE domain IS NOT NULL
      GROUP BY domain
      ORDER BY thought_count DESC
    `);

    if (domainStats.rows.length > 0) {
      domainStats.rows.forEach(row => {
        console.log(
          `${row.domain}: ${row.thought_count} thoughts across ${row.unique_sessions} sessions (avg confidence: ${row.avg_confidence || 'N/A'})`
        );
      });
    } else {
      console.log('No domain data available');
    }

    // 3. Sample Data Verification
    console.log('\n🔬 SAMPLE DATA VERIFICATION');
    console.log('-'.repeat(40));

    const sampleData = await store.query(`
      SELECT 
        s.objective,
        s.domain,
        s.goal_achieved,
        t.thought,
        t.confidence
      FROM reasoning_sessions s
      JOIN stored_thoughts t ON s.id = t.session_id
      LIMIT 3
    `);

    if (sampleData.rows.length > 0) {
      console.log('✅ Sample data found:');
      sampleData.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.objective} (${row.domain || 'no domain'})`);
        console.log(`     Thought: "${row.thought.substring(0, 80)}..."`);
        console.log(
          `     Confidence: ${row.confidence || 'N/A'}, Goal Achieved: ${row.goal_achieved}`
        );
      });
    } else {
      console.log('⚠️  No sample data found - database may be empty');
    }

    // 4. Database Health
    console.log('\n💾 DATABASE HEALTH');
    console.log('-'.repeat(40));

    const healthCheck = await store.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('reasoning_sessions', 'stored_thoughts')
    `);

    const health = healthCheck.rows[0];
    console.log(`Database Size: ${health.database_size}`);
    console.log(`Core Tables Present: ${health.table_count}/2`);

    await store.close();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Database Report Generated Successfully');
    console.log('🎉 PostgreSQL Memory Store is operational!');

    return true;
  } catch (error) {
    console.error('\n❌ Report generation failed:', error);
    await store.close();
    return false;
  }
}

generateDatabaseReport().catch(console.error);
