# PostgreSQL Database Setup & Configuration

The Sentient AGI Reasoning Server supports persistent storage through PostgreSQL, providing advanced analytics, time-series data tracking, and production-ready scalability.

## Quick Start

### 1. Enable PostgreSQL Memory Store

```bash
# Set environment variables
export MEMORY_STORE_TYPE=postgresql
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=map_think_do
export POSTGRES_USER=mtd_user
export POSTGRES_PASSWORD=p4ssw0rd
```

### 2. Start Database Container

```bash
# Start PostgreSQL with TimescaleDB
npm run db:start

# Or use podman-compose directly
podman-compose up -d postgresql
```

### 3. Verify Setup

```bash
# Generate database report
node generate-database-report.js

# Run acceptance tests
npm run build
node dist/test/memory/run-acceptance-tests.js
```

## Claude Desktop Configuration

Add this to your Claude Desktop `claude.json`:

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
        "POSTGRES_POOL_MAX": "20",
        "POSTGRES_POOL_MIN": "5",
        "POSTGRES_ENABLE_TIMESERIES": "true",
        "PERFORMANCE_MODE": "balanced"
      }
    }
  }
}
```

## Database Management Scripts

```bash
# Database lifecycle management
npm run db:start    # Start PostgreSQL container
npm run db:stop     # Stop PostgreSQL container
npm run db:restart  # Restart PostgreSQL container
npm run db:status   # Check container status
npm run db:logs     # View database logs
npm run db:clean    # Clean database data
```

## Schema & Features

### Core Tables

**reasoning_sessions**
- Session metadata and cognitive metrics
- Success tracking and learning insights
- TimescaleDB hypertable for time-series analytics

**stored_thoughts**
- Individual thoughts with branching/revision tracking
- JSONB context storage for flexible metadata
- Full-text search and similarity matching

### Advanced Features

- **TimescaleDB Integration**: Automatic time-series partitioning and compression
- **Connection Pooling**: Configurable pool sizes for production scaling
- **Full-Text Search**: PostgreSQL's built-in text search capabilities
- **Similarity Matching**: pg_trgm extension for fuzzy text matching
- **JSON Analytics**: Advanced JSONB queries for context analysis

## Environment Variables

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
| `POSTGRES_SSL` | Enable SSL connections | false |
| `POSTGRES_DEBUG` | Enable debug logging | false |

## Troubleshooting

### Connection Issues

```bash
# Check if container is running
podman ps | grep postgresql

# View container logs
npm run db:logs

# Test direct connection
psql -h localhost -U mtd_user -d map_think_do -c "SELECT 1"
```

### Performance Issues

```sql
-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Monitor query performance (requires pg_stat_statements)
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Schema Reset

```bash
# Reinitialize database schema
podman exec -it sentient-agi-postgresql psql -U mtd_user -d map_think_do -f /docker-entrypoint-initdb.d/02-schema.sql
```

## Production Considerations

### Security Checklist

- [ ] Enable SSL/TLS connections
- [ ] Use strong passwords
- [ ] Configure firewall rules
- [ ] Enable connection logging
- [ ] Set up regular backups
- [ ] Monitor resource usage

### Scaling Configuration

```bash
# Increase connection pool for high-traffic
export POSTGRES_POOL_MAX=50
export POSTGRES_POOL_MIN=10

# Enable SSL for production
export POSTGRES_SSL=true

# Optimize for production workload
export POSTGRES_ENABLE_TIMESERIES=true
```

### Backup & Recovery

```bash
# Create backup
pg_dump -h localhost -U mtd_user -d map_think_do > backup.sql

# Restore backup
psql -h localhost -U mtd_user -d map_think_do < backup.sql
```

See [MEMORYSTORE_DB.md](./MEMORYSTORE_DB.md) for detailed API documentation and advanced usage examples.