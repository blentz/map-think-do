# PostgreSQL Memory Store Implementation

This document describes the PostgreSQL memory store implementation for the Sentient AGI Reasoning Server, providing persistent storage for cognitive data with advanced analytics capabilities.

## Overview

The PostgreSQL memory store replaces the default in-memory storage with a persistent, production-ready database solution optimized for cognitive workloads. It provides:

- **Persistent Storage**: Data survives server restarts and system reboots
- **Time-Series Analytics**: TimescaleDB integration for cognitive performance tracking
- **Advanced Querying**: SQL-based analytics with complex filtering and aggregation
- **Scalability**: Handles large datasets with connection pooling and indexing
- **Data Integrity**: ACID compliance with constraint validation

## Quick Start

### 1. Environment Setup

Set the memory store type to PostgreSQL:

```bash
export MEMORY_STORE_TYPE=postgresql
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=map_think_do
export POSTGRES_USER=mtd_user
export POSTGRES_PASSWORD=p4ssw0rd
```

### 2. Start PostgreSQL Container

```bash
# Start the PostgreSQL container with TimescaleDB
podman-compose up -d postgresql

# Or start with pgAdmin for development
podman-compose --profile dev up -d
```

### 3. Verify Setup

```bash
# Generate a database report to verify functionality
node generate-database-report.js

# Run acceptance tests
node dist/test/memory/run-acceptance-tests.js
```

## Architecture

### Database Schema

The implementation uses two core tables:

**reasoning_sessions**: Stores complete reasoning sessions
- Session metadata (start/end times, objectives, domains)
- Cognitive metrics (confidence levels, effectiveness scores)
- Learning insights (lessons learned, successful strategies)
- Array fields for tags and cognitive patterns

**stored_thoughts**: Stores individual thoughts within sessions
- Thought content and metadata
- Branching and revision tracking
- JSONB context storage for flexible metadata
- Array fields for tags and detected patterns

### TimescaleDB Integration

When TimescaleDB is available, tables are converted to hypertables for:
- Efficient time-series data storage
- Automatic partitioning by time
- Optimized queries for temporal analytics
- Compression for historical data

### Indexing Strategy

- **Time-based indexes**: Optimized for chronological queries
- **Domain indexes**: Fast filtering by cognitive domains
- **GIN indexes**: Efficient array and JSONB operations
- **Similarity indexes**: Text similarity search (pg_trgm)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMORY_STORE_TYPE` | Store type (memory\|postgresql) | memory |
| `POSTGRES_HOST` | Database host | localhost |
| `POSTGRES_PORT` | Database port | 5432 |
| `POSTGRES_DB` | Database name | map_think_do |
| `POSTGRES_USER` | Database user | mtd_user |
| `POSTGRES_PASSWORD` | Database password | p4ssw0rd |
| `POSTGRES_POOL_MAX` | Max connections | 20 |
| `POSTGRES_POOL_MIN` | Min connections | 5 |
| `POSTGRES_ENABLE_TIMESERIES` | Enable TimescaleDB | true |

### SSL Configuration

For production deployments, enable SSL:

```bash
export POSTGRES_SSL=true
# Or with custom configuration
export POSTGRES_SSL='{"rejectUnauthorized": false}'
```

## Usage Examples

### Basic Operations

```typescript
import { PostgreSQLMemoryStore } from './src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './src/memory/postgresql-config.js';

// Initialize store
const store = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
await store.initialize();

// Store a reasoning session
const session = {
  id: 'session_123',
  start_time: new Date(),
  objective: 'Solve complex problem',
  domain: 'software_development',
  goal_achieved: false,
  confidence_level: 0.8,
  total_thoughts: 5,
  revision_count: 1,
  branch_count: 0,
};
await store.storeSession(session);

// Store thoughts
const thought = {
  id: 'thought_456',
  session_id: 'session_123',
  thought: 'First approach to solving the problem...',
  thought_number: 1,
  total_thoughts: 5,
  next_thought_needed: true,
  timestamp: new Date(),
  confidence: 0.75,
  domain: 'software_development',
  context: {
    problem_type: 'debugging',
    cognitive_load: 0.6,
  },
  tags: ['debugging', 'systematic'],
};
await store.storeThought(thought);
```

### Advanced Queries

```typescript
// Query by domain and confidence
const results = await store.queryThoughts({
  domain: 'software_development',
  confidence_range: [0.7, 1.0],
  limit: 50,
  sort_by: 'timestamp',
  sort_order: 'desc',
});

// Find similar thoughts
const similar = await store.findSimilarThoughts(
  'debugging systematic approach',
  10
);

// Get comprehensive statistics
const stats = await store.getStats();
console.log(`Total thoughts: ${stats.total_thoughts}`);
console.log(`Success rate: ${stats.overall_success_rate}`);
```

### Data Migration

```typescript
import { MemoryStoreMigrator } from './src/memory/migrations/memory-store-migrator.js';

// Migrate from in-memory to PostgreSQL
const migrator = new MemoryStoreMigrator(inMemoryStore, postgresStore, {
  batchSize: 100,
  continueOnError: true,
  validateAfterMigration: true,
});

const stats = await migrator.migrate();
console.log(`Migrated ${stats.thoughts.migrated} thoughts`);
```

## Monitoring and Maintenance

### Health Checks

The PostgreSQL store includes built-in health monitoring:
- Connection pool status monitoring
- Automatic reconnection on failures
- Query performance tracking
- Memory usage monitoring

### Performance Optimization

```sql
-- Manual optimization (run periodically)
VACUUM ANALYZE stored_thoughts;
VACUUM ANALYZE reasoning_sessions;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename IN ('stored_thoughts', 'reasoning_sessions');
```

### Backup and Recovery

```bash
# Create backup
pg_dump -h localhost -U mtd_user -d map_think_do > backup.sql

# Restore backup
psql -h localhost -U mtd_user -d map_think_do < backup.sql

# Export data for analysis
node -e "
const store = new PostgreSQLMemoryStore();
await store.initialize();
const data = await store.exportData('json');
console.log(data);
"
```

## Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check if PostgreSQL is running
podman ps | grep postgresql

# Check logs
podman logs sentient-agi-postgresql

# Verify connection settings
psql -h localhost -U mtd_user -d map_think_do -c "SELECT 1"
```

**Schema Errors**
```bash
# Reinitialize schema
podman exec -it sentient-agi-postgresql psql -U mtd_user -d map_think_do -f /docker-entrypoint-initdb.d/02-schema.sql
```

**Performance Issues**
```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Monitor query performance
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Debug Mode

Enable debug logging:

```bash
export POSTGRES_DEBUG=true
export POSTGRES_LOG_QUERIES=true
```

## Development

### Running Tests

```bash
# Start test database
podman-compose up -d postgresql

# Run acceptance tests
npm run build
node dist/test/memory/run-acceptance-tests.js

# Generate test report
node generate-database-report.js
```

### Container Development

```bash
# Build custom container
podman build -f Containerfile.postgresql -t sentient-agi-postgres .

# Development with hot reload
podman-compose --profile dev up -d
```

## Production Deployment

### Security Checklist

- [ ] Enable SSL/TLS connections
- [ ] Use strong passwords
- [ ] Configure firewall rules
- [ ] Enable connection logging
- [ ] Set up regular backups
- [ ] Monitor resource usage
- [ ] Update PostgreSQL regularly

### Scaling Considerations

- **Connection Pooling**: Tune `POSTGRES_POOL_MAX` based on workload
- **Memory Settings**: Adjust `shared_buffers` and `work_mem` in postgresql.conf
- **Storage**: Use SSDs for optimal performance
- **Monitoring**: Set up Prometheus/Grafana for metrics
- **Backup**: Implement automated backup strategy

### High Availability

For production systems, consider:
- PostgreSQL streaming replication
- Connection pooling with PgBouncer
- Load balancing with HAProxy
- Automated failover solutions
- Cross-datacenter replication

## API Reference

### PostgreSQLMemoryStore Class

#### Methods

- `initialize()`: Initialize database connection and schema
- `storeThought(thought)`: Store a single thought
- `storeSession(session)`: Store a reasoning session
- `queryThoughts(query)`: Query thoughts with filters
- `getThought(id)`: Retrieve thought by ID
- `getSession(id)`: Retrieve session by ID
- `findSimilarThoughts(text, limit)`: Find similar thoughts
- `getStats()`: Get comprehensive statistics
- `exportData(format)`: Export data in JSON/CSV format
- `close()`: Close database connections

#### Configuration

See `PostgreSQLConfig` interface in `src/memory/postgresql-config.ts` for complete configuration options.

## Contributing

When contributing to the PostgreSQL memory store:

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update this documentation
4. Ensure backward compatibility
5. Test with both development and production configurations

## License

This implementation is part of the Sentient AGI Reasoning Server and follows the same MIT license terms.