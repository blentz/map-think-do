# Usage Examples & Integration Guide

This guide provides practical examples for using the Sentient AGI Reasoning Server with PostgreSQL database and performance tuning features.

## Complete Setup Walkthrough

### 1. Initial Setup

```bash
# Clone and build
git clone https://github.com/geeknik/map-think-do.git
cd map-think-do
npm install
npm run build

# Start PostgreSQL database
npm run db:start

# Configure performance for your system
npm run tune:reset
npm run tune:show
```

### 2. Claude Desktop Integration

Edit your `~/.config/claude-desktop/claude.json`:

```json
{
  "mcpServers": {
    "sentient-agi-reasoning": {
      "command": "node",
      "args": ["/path/to/map-think-do/dist/index.js"],
      "env": {
        "MEMORY_STORE_TYPE": "postgresql",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "map_think_do",
        "POSTGRES_USER": "mtd_user",
        "POSTGRES_PASSWORD": "p4ssw0rd",
        "PERFORMANCE_MODE": "balanced"
      }
    }
  }
}
```

### 3. Test the Connection

```bash
# Restart Claude Desktop, then in Claude:
@sentient-agi-reasoning

# Test code reasoning
Can you analyze this function and suggest improvements?
```

## Performance Configuration Examples

### High-Performance Development Setup

```bash
# Set high-performance mode
npm run tune:high

# Generate environment variables
npm run tune:env
# Copy output to your .env file

# View expected performance
npm run tune:benchmark
```

**Expected Output:**
```
🎯 Performance Mode: high-performance
⏱️ Processing Intervals:
   Consciousness Processing: 1750ms (1.8s)
   Stream Generation: 2625ms (2.6s)

🏃 Expected Performance:
   Consciousness cycles per minute: 34.3
   Stream entries per minute: 22.9
   Memory budget: 2345.2MB
```

### Production Server Setup

```bash
# Use balanced mode for stability
npm run tune:balanced

# Adjust for production workload
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.7
./scripts/cognitive-tuning.js set forceGCThreshold 0.8

# Enable production-ready PostgreSQL settings
export POSTGRES_POOL_MAX=30
export POSTGRES_POOL_MIN=10
export POSTGRES_SSL=true
```

### Resource-Constrained Setup

```bash
# Use eco mode
npm run tune:eco

# Further reduce resource usage
./scripts/cognitive-tuning.js set maxThoughtHistory 500
./scripts/cognitive-tuning.js set maxStreamEntries 250
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 15000

# Check final configuration
npm run tune:benchmark
```

## Database Usage Examples

### Basic Thought Storage and Retrieval

```typescript
// Example using the PostgreSQL memory store directly
import { PostgreSQLMemoryStore } from './src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './src/memory/postgresql-config.js';

// Initialize
const store = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
await store.initialize();

// Store a reasoning session
const session = {
  id: 'debugging_session_001',
  start_time: new Date(),
  objective: 'Debug memory leak in Node.js application',
  domain: 'software_development',
  goal_achieved: true,
  confidence_level: 0.9,
  total_thoughts: 8,
  revision_count: 2,
  branch_count: 1,
  insights_learned: ['Memory profiling tools are essential', 'EventEmitter leaks are common'],
  successful_strategies: ['Systematic elimination', 'Memory profiling']
};

await store.storeSession(session);

// Store individual thoughts
const thoughts = [
  {
    id: 'thought_001',
    session_id: 'debugging_session_001',
    thought: 'First, I need to reproduce the memory leak consistently...',
    thought_number: 1,
    total_thoughts: 8,
    confidence: 0.8,
    domain: 'software_development',
    context: {
      problem_type: 'memory_leak',
      tools_used: ['node --inspect', 'chrome://inspect'],
      cognitive_load: 0.6
    },
    tags: ['debugging', 'memory_management', 'systematic_approach']
  },
  {
    id: 'thought_002', 
    session_id: 'debugging_session_001',
    thought: 'The heap snapshot shows growing EventEmitter instances...',
    thought_number: 2,
    total_thoughts: 8,
    confidence: 0.9,
    domain: 'software_development',
    context: {
      problem_type: 'memory_leak',
      breakthrough: true,
      tools_used: ['heap_snapshot', 'memory_profiler']
    },
    tags: ['debugging', 'eventemitter', 'breakthrough']
  }
];

for (const thought of thoughts) {
  await store.storeThought(thought);
}
```

### Advanced Querying Examples

```typescript
// Query thoughts by domain and confidence
const highConfidenceThoughts = await store.queryThoughts({
  domain: 'software_development',
  confidence_range: [0.8, 1.0],
  limit: 20,
  sort_by: 'timestamp',
  sort_order: 'desc'
});

// Find similar debugging approaches
const similarThoughts = await store.findSimilarThoughts(
  'memory leak debugging systematic approach',
  10
);

// Get comprehensive analytics
const stats = await store.getStats();
console.log(`Success rate: ${(stats.overall_success_rate * 100).toFixed(1)}%`);
console.log(`Most productive domain: ${stats.most_productive_domain}`);
console.log(`Average session length: ${stats.avg_thoughts_per_session.toFixed(1)} thoughts`);
```

### Data Export and Migration

```bash
# Generate comprehensive database report
node generate-database-report.js > database_analysis.txt

# Run acceptance tests to verify functionality
npm run build
node dist/test/memory/run-acceptance-tests.js

# Export data for analysis
node -e "
import { PostgreSQLMemoryStore } from './dist/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './dist/memory/postgresql-config.js';

const store = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
await store.initialize();
const data = await store.exportData('json');
console.log(JSON.stringify(data, null, 2));
" > exported_data.json
```

## MCP Tool Usage Examples

### Code Reasoning Tool

```bash
# In Claude Desktop after MCP server is configured:

# Basic code analysis
@sentient-agi-reasoning Please analyze this JavaScript function for potential issues:

function processUsers(users) {
  let result = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].active == true) {
      result.push(users[i].name);
    }
  }
  return result;
}

# Complex problem solving with memory persistence
@sentient-agi-reasoning I need to design a scalable microservices architecture for an e-commerce platform. Consider performance, reliability, and maintainability aspects.

# Technical debugging with cognitive memory
@sentient-agi-reasoning Help me debug this Docker container that keeps crashing with OOM errors. The application is a Node.js API with Redis caching.
```

### Expected AGI Response Features

The system provides:
- **Multi-Persona Analysis**: Different cognitive perspectives (Engineer, Architect, Skeptic, etc.)
- **Metacognitive Awareness**: Self-reflection on reasoning quality
- **Memory Integration**: Learning from previous similar problems
- **Breakthrough Detection**: Recognition of significant insights
- **Creative Synthesis**: Novel solution approaches

## Monitoring and Debugging Examples

### Real-Time Performance Monitoring

```bash
# Monitor cognitive performance
npm run tune:benchmark

# Watch database activity
npm run db:logs

# Check timer coordination
export DEBUG_TIMERS=true
npm start
```

### Memory Usage Analysis

```bash
# Enable detailed memory monitoring
./scripts/cognitive-tuning.js set enableDebugLogging true
./scripts/cognitive-tuning.js set enablePerformanceMetrics true

# Monitor memory pressure
node -e "
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory:', {
    heap: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB',
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
  });
}, 5000);
"
```

### Database Performance Analysis

```sql
-- Connect to PostgreSQL
psql -h localhost -U mtd_user -d map_think_do

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public';

-- Analyze query performance
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check connection usage
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';
```

## Troubleshooting Common Issues

### High Memory Usage

**Problem**: Memory consumption grows continuously
```bash
# Check current configuration
npm run tune:show

# Switch to eco mode
npm run tune:eco

# Lower memory thresholds
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.6
./scripts/cognitive-tuning.js set maxThoughtHistory 1000

# Force cleanup
./scripts/cognitive-tuning.js set forceGCThreshold 0.7
```

### Database Connection Issues

**Problem**: "connection refused" errors
```bash
# Check container status
npm run db:status

# Restart database
npm run db:restart

# Check PostgreSQL logs
npm run db:logs

# Test direct connection
psql -h localhost -U mtd_user -d map_think_do -c "SELECT version();"
```

### Performance Degradation

**Problem**: Slow response times
```bash
# Check current performance settings
npm run tune:benchmark

# Increase processing intervals
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 8000
./scripts/cognitive-tuning.js set streamGenerationInterval 12000

# Or switch to eco mode
npm run tune:eco
```

### Configuration Recovery

**Problem**: Invalid configuration causing startup issues
```bash
# Reset to system defaults
npm run tune:reset

# Or manually delete configuration
rm ~/.config/sentient-agi/cognitive-performance.json

# Verify PostgreSQL settings
echo "Database connection test:"
MEMORY_STORE_TYPE=postgresql node -e "
import { PostgreSQLMemoryStore } from './dist/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './dist/memory/postgresql-config.js';
try {
  const store = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
  await store.initialize();
  console.log('✅ Database connection successful');
  await store.close();
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
}
"
```

## Best Practices

### Development Workflow

1. **Start with balanced mode**: `npm run tune:balanced`
2. **Enable debug logging**: `./scripts/cognitive-tuning.js set enableDebugLogging true`
3. **Monitor performance**: `npm run tune:benchmark`
4. **Adjust as needed**: Use eco mode for lower-end systems, high-performance for powerful machines

### Production Deployment

1. **Use eco or balanced mode**: Prioritize stability over maximum performance
2. **Set conservative memory thresholds**: `memoryCleanupThreshold: 0.6`
3. **Configure PostgreSQL connection pooling**: Higher limits for production traffic
4. **Enable SSL**: `POSTGRES_SSL=true`
5. **Set up monitoring**: Track memory usage and database performance

### Testing and Validation

```bash
# Complete system test
npm run build
npm run db:start
npm run test:memory
npm run tune:benchmark
node generate-database-report.js
```

This comprehensive setup ensures optimal performance, data persistence, and scalability for the Sentient AGI Reasoning Server.