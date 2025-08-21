# Observability with Arize Phoenix

This document describes the integrated observability capabilities of the Sentient AGI MCP Server using self-hosted Arize Phoenix for comprehensive monitoring, tracing, and performance analysis.

## Overview

The MCP server includes built-in observability using:
- **Arize Phoenix**: Self-hosted observability platform for AI applications
- **OpenTelemetry**: Industry-standard instrumentation framework
- **PostgreSQL**: Shared database for Phoenix and MCP data
- **Prometheus Metrics**: Existing metrics bridged to Phoenix

## Quick Start

### 1. Start Phoenix Container

Phoenix is automatically started with the PostgreSQL database:

```bash
# Start all services
podman-compose up -d

# Verify Phoenix is running
podman ps | grep phoenix
```

### 2. Access Phoenix Dashboard

Open your browser to: http://localhost:6006

### 3. Enable Telemetry

Telemetry is enabled by default. To disable:

```bash
export TELEMETRY_ENABLED=false
npm start
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   MCP Server    │────▶│   OpenTelemetry  │────▶│  Arize Phoenix  │
│                 │     │   Instrumentation│     │  (localhost:6006)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                 │
         │                                                 │
         ▼                                                 ▼
┌─────────────────┐                          ┌─────────────────┐
│  PostgreSQL DB  │◀─────────────────────────│  Phoenix Schema │
│  (MCP Data)     │                          │  (Traces/Metrics)│
└─────────────────┘                          └─────────────────┘
```

## Configuration

### Environment Variables

```bash
# Telemetry Configuration
TELEMETRY_ENABLED=true                    # Enable/disable telemetry
PHOENIX_ENDPOINT=http://localhost:6006    # Phoenix endpoint
TELEMETRY_SAMPLING_RATE=1.0              # Sampling rate (0.0-1.0)
TELEMETRY_SERVICE_NAME=sentient-agi-mcp-server  # Service name
NODE_ENV=development                       # Environment (development/production)
TELEMETRY_EXPORT_METRICS=true            # Export Prometheus metrics to Phoenix
TELEMETRY_METRICS_INTERVAL=30000         # Metrics export interval (ms)
```

### Configuration File

Update `src/utils/config-manager.ts` for programmatic configuration:

```typescript
telemetry: {
  enabled: true,
  endpoint: 'http://localhost:6006',
  samplingRate: 1.0,
  serviceName: 'sentient-agi-mcp-server',
  environment: 'development',
  exportMetrics: true,
  metricsIntervalMs: 30000,
}
```

## Instrumentation Coverage

### MCP Protocol Operations
- Tool calls with request/response tracking
- Thought processing with cognitive metrics
- Session management and lifecycle

### Cognitive System
- Plugin activation and orchestration
- Persona switching and contributions
- Breakthrough detection events
- Metacognitive reflection tracking
- Pattern recognition events

### Database Operations
- Query performance tracking
- Connection pool metrics
- Transaction monitoring
- Schema isolation (phoenix vs public)

### Prometheus Metrics Bridge
- All existing Prometheus metrics exported to Phoenix
- Real-time cognitive metrics
- Performance trends and alerts

## Viewing Traces

### Phoenix Dashboard Features

1. **Traces View**: See all MCP tool calls and operations
2. **Metrics View**: Monitor cognitive metrics over time
3. **Service Map**: Visualize component interactions
4. **Latency Analysis**: Identify performance bottlenecks

### Example Queries

Filter traces by tool:
```
mcp.tool = "code-reasoning"
```

Find high-complexity thoughts:
```
cognitive.complexity > 8
```

Track breakthrough events:
```
cognitive.event_type = "breakthrough_detected"
```

## Performance Monitoring

### Key Metrics

- **Latency**: <1ms overhead for local operations
- **Memory**: Phoenix container limited to 2GB
- **Sampling**: Configurable rate for production
- **Throughput**: Traces per second

### Resource Usage

Monitor Phoenix container resources:
```bash
podman stats sentient-agi-phoenix
```

Check database schema sizes:
```sql
SELECT 
  schemaname,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size
FROM pg_tables
WHERE schemaname IN ('public', 'phoenix')
GROUP BY schemaname;
```

## Troubleshooting

### Phoenix Not Starting

1. Check container logs:
```bash
podman logs sentient-agi-phoenix
```

2. Verify database connectivity:
```bash
podman exec -it sentient-agi-postgresql psql -U mtd_user -d map_think_do -c "\dn"
```

3. Ensure Phoenix schema exists:
```bash
cat scripts/phoenix-schema-setup.sql | podman exec -i sentient-agi-postgresql psql -U mtd_user -d map_think_do
```

### No Traces Appearing

1. Verify telemetry is enabled:
```bash
echo $TELEMETRY_ENABLED
```

2. Check MCP server logs for telemetry initialization:
```bash
npm start 2>&1 | grep -i telemetry
```

3. Test connection to Phoenix:
```bash
curl http://localhost:6006/health
```

### High Memory Usage

1. Adjust sampling rate:
```bash
export TELEMETRY_SAMPLING_RATE=0.1  # Sample 10% of traces
```

2. Reduce batch size in `instrumentation.ts`:
```typescript
maxQueueSize: 1024,  // Reduce from 2048
maxExportBatchSize: 256,  // Reduce from 512
```

## Security Considerations

- **Local Only**: Phoenix runs locally with no external dependencies
- **No API Keys**: Self-hosted deployment requires no authentication
- **Schema Isolation**: Phoenix uses separate database schema
- **Network Isolation**: Container network prevents external access
- **Data Privacy**: All telemetry data stays on local machine

## Advanced Configuration

### Custom Span Attributes

Add custom attributes to spans:

```typescript
import { MCPInstrumentation } from './telemetry/mcp-instrumentation.js';

const instrumentation = MCPInstrumentation.getInstance();
instrumentation.setAttributeOnCurrentSpan('custom.attribute', value);
```

### Custom Events

Record custom events:

```typescript
instrumentation.addEventToCurrentSpan('custom.event', {
  detail: 'Custom event details',
  timestamp: Date.now(),
});
```

### Cognitive Metrics

Record cognitive metrics:

```typescript
import { CognitiveInstrumentation } from './telemetry/cognitive-instrumentation.js';

const cognitive = CognitiveInstrumentation.getInstance();
cognitive.recordCognitiveMetrics({
  metacognitiveAwareness: 0.8,
  creativePressure: 0.6,
  breakthroughLikelihood: 0.4,
});
```

## Maintenance

### Cleanup Old Traces

Phoenix automatically manages trace retention. To manually clean:

```sql
-- Connect to Phoenix schema
\c map_think_do
SET search_path TO phoenix;

-- Delete traces older than 7 days
DELETE FROM traces WHERE timestamp < NOW() - INTERVAL '7 days';
```

### Backup Phoenix Data

```bash
# Backup Phoenix schema
podman exec sentient-agi-postgresql pg_dump -U mtd_user -d map_think_do -n phoenix > phoenix_backup.sql

# Restore Phoenix schema
cat phoenix_backup.sql | podman exec -i sentient-agi-postgresql psql -U mtd_user -d map_think_do
```

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Start Phoenix for testing
  run: |
    podman-compose up -d phoenix postgresql
    sleep 10  # Wait for startup
    
- name: Run tests with telemetry
  env:
    TELEMETRY_ENABLED: true
    PHOENIX_ENDPOINT: http://localhost:6006
  run: npm test
```

## Further Resources

- [Arize Phoenix Documentation](https://docs.arize.com/phoenix)
- [OpenTelemetry Node.js Guide](https://opentelemetry.io/docs/languages/js/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)