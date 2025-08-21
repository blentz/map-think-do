name: "Arize Phoenix Self-Hosted Integration for MCP Server Observability"
description: |

## Purpose
Integration of self-hosted Arize Phoenix observability platform using Podman containers into the Sentient AGI MCP server to provide comprehensive monitoring, tracing, and performance analysis of cognitive operations, enabling users to visualize and validate the functioning of the MCP server while measuring the impact of AGI reasoning capabilities - all with complete data privacy and local control.

## Core Principles
1. **User Knows Best**: Stop working and ask the user questions when problems are too complex to solve on your own
2. **Context is King**: Include ALL necessary documentation, examples, and caveats
3. **Validation Loops**: Provide executable tests/lints the AI can run and fix
4. **Information Dense**: Use keywords and patterns from the codebase
5. **Progressive Success**: Start simple, validate, then enhance
6. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Build comprehensive observability into the Sentient AGI MCP server using self-hosted Phoenix to:
- Provide real-time visibility into MCP protocol operations and message flow
- Track cognitive plugin activation patterns and persona contributions
- Measure the impact of AGI reasoning on Claude's responses
- Create actionable insights for system optimization and debugging
- Enable performance monitoring with minimal overhead (<1ms local network latency)
- Maintain complete data privacy with local-only deployment

## Why
- **Business Value**: Enables users to validate that their MCP server is functioning correctly and understand its impact on AI reasoning
- **Integration Benefits**: 
  - Leverages existing PostgreSQL database and Podman infrastructure
  - No cloud dependencies or costs
  - Complete data privacy and control
  - Predictable local network performance
- **Problems Solved**: 
  - Black-box nature of MCP server operations
  - Difficulty measuring AGI enhancement effectiveness
  - Lack of visibility into cognitive decision paths
  - No way to replay and analyze reasoning sequences
  - Privacy concerns with cloud telemetry

## What
User-visible features:
- Real-time Phoenix dashboard at http://localhost:6006
- Trace visualization of thought processing sequences
- Cognitive state monitoring and persona analytics
- Performance metrics and alerting
- Reasoning replay capability for debugging
- Complete local control with no external dependencies

Technical requirements:
- Self-hosted Phoenix container via Podman
- OpenTelemetry-based instrumentation
- Phoenix client integration for TypeScript/Node.js
- Custom spans for MCP-specific operations
- Shared PostgreSQL database with MCP server
- Minimal performance overhead (<1ms local latency)

### Success Criteria
- [ ] Phoenix container running via Podman at http://localhost:6006
- [ ] Complete tracing of MCP tool calls and responses
- [ ] Cognitive metrics visible (metacognitive awareness, breakthrough detection, etc.)
- [ ] Performance overhead <1ms (local network) verified
- [ ] All existing tests passing with telemetry enabled
- [ ] No database schema conflicts between Phoenix and MCP
- [ ] Resource usage under 2GB memory for Phoenix container
- [ ] Documentation for using observability features

## All Needed Context

### Documentation & References (list all context needed to implement the feature)
```yaml
# MUST READ - Include these in your context window
- url: https://arize.com/docs/phoenix/self-hosting
  why: Self-hosting Phoenix with Docker/Podman, database configuration

- url: https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/javascript
  why: TypeScript/Node.js setup instructions for Phoenix tracing

- url: https://github.com/Arize-ai/phoenix
  why: Main repository with container images and deployment examples

- url: https://github.com/Arize-ai/openinference
  why: OpenTelemetry instrumentation for AI observability

- url: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
  why: OpenTelemetry Node.js setup and best practices

- file: src/server.ts
  why: Main MCP server implementation - primary instrumentation target

- file: src/cognitive/cognitive-orchestrator.ts
  why: Cognitive system coordinator - track plugin orchestration

- file: src/monitoring/prometheus-metrics.ts
  why: Existing metrics system to integrate with

- file: scripts/monitoring-system.js
  why: Current monitoring implementation to extend

- file: src/memory/postgresql-memory-store.ts
  why: Database operations to instrument

- file: podman-compose.yml
  why: Existing Podman configuration to extend with Phoenix container

- docfile: CLAUDE.md
  why: Project conventions and architecture overview
```

### Current Codebase tree (run `tree` in the root of the project) to get an overview of the codebase
```bash
src/
├── cognitive/
│   ├── cognitive-orchestrator.ts      # Central brain - needs tracing
│   ├── plugins/                       # All cognitive plugins
│   └── external-reasoning/            # External tools
├── memory/
│   ├── postgresql-memory-store.ts     # Database operations
│   └── prompt-intelligence/           # Prompt analysis
├── monitoring/
│   └── prometheus-metrics.ts          # Existing metrics (integrate)
├── prompts/
│   └── manager.ts                     # Prompt management
├── server.ts                          # Main MCP server
└── utils/
    ├── config-manager.ts              # Configuration
    └── timer-manager.ts               # Performance timing
```

### Desired Codebase tree with files to be added and responsibility of file
```bash
src/
├── telemetry/                        # NEW: Phoenix integration
│   ├── phoenix-client.ts             # Phoenix client initialization
│   ├── instrumentation.ts            # OpenTelemetry setup
│   ├── mcp-instrumentation.ts        # MCP-specific spans
│   ├── cognitive-instrumentation.ts  # Cognitive system tracing
│   ├── db-instrumentation.ts         # Database query tracing
│   ├── dashboard-launcher.ts         # Phoenix dashboard utilities
│   └── telemetry-config.ts          # Configuration management
├── cognitive/
│   └── cognitive-orchestrator.ts     # MODIFY: Add telemetry hooks
├── monitoring/
│   ├── prometheus-metrics.ts         # MODIFY: Export to Phoenix
│   └── phoenix-adapter.ts           # NEW: Bridge to Phoenix
└── server.ts                         # MODIFY: Initialize telemetry
```

### Known Gotchas of our codebase & Library Quirks
```typescript
// CRITICAL: MCP servers must NEVER log to stdout - only stderr
// Use console.error() for all logging, not console.log()

// CRITICAL: Phoenix requires Node v18+ for ESM modules
// We're using Node v23 with TypeScript support

// CRITICAL: OpenTelemetry must be initialized before other imports
// instrumentation.ts must be imported first in index.ts

// NEW: Self-hosted Phoenix advantages
// - No API keys or cloud authentication needed
// - Direct localhost:6006 connection
// - Shares PostgreSQL with MCP server (use schemas for separation)
// - Container networking via sentient-agi-network

// PATTERN: All async operations use TimerManager for timing
// Hook into TimerManager.time() for automatic span creation

// GOTCHA: PostgreSQL connections are pooled
// Instrument at pool level, not individual queries

// PATTERN: Cognitive plugins emit events via EventEmitter
// Subscribe to events for non-invasive instrumentation

// GOTCHA: Memory store operations can be sync or async
// Check method signatures before adding async instrumentation

// PODMAN: Use existing sentient-agi-network for container communication
// Phoenix can connect to postgresql container by name
```

## Implementation Blueprint

### Data models and structure

Create telemetry configuration and types:
```typescript
// src/telemetry/types.ts
interface PhoenixConfig {
  endpoint: string;          // Phoenix collector endpoint
  apiKey?: string;          // Optional API key
  serviceName: string;      // 'sentient-agi-mcp-server'
  environment: string;      // 'development' | 'production'
  samplingRate: number;     // 0.0-1.0
}

interface CognitiveSpanAttributes {
  'mcp.tool': string;
  'mcp.request_id': string;
  'cognitive.persona': string;
  'cognitive.metacognitive_awareness': number;
  'cognitive.breakthrough_likelihood': number;
  'cognitive.thought_number': number;
  'cognitive.session_id': string;
}

interface TelemetryContext {
  tracer: Tracer;
  phoenixClient: PhoenixClient;
  config: PhoenixConfig;
}
```

### list of tasks to be completed to fullfill the PRP in the order they should be completed

```yaml
Task 1: Setup Phoenix Container in Podman
EXECUTE scripts/phoenix-schema-setup.sql:
  - CREATE phoenix schema in PostgreSQL
  - GRANT permissions to mtd_user
  - RUN: cat scripts/phoenix-schema-setup.sql | podman exec -i sentient-agi-postgresql psql -U mtd_user -d map_think_do

MODIFY podman-compose.yml:
  - ADD Phoenix service with PostgreSQL connection
  - SET PHOENIX_SQL_DATABASE_SCHEMA=phoenix for isolation
  - CONFIGURE resource limits (2GB memory, 1 CPU)
  - USE sentient-agi-network for container networking
  - RUN: podman-compose up -d phoenix
  - VERIFY: http://localhost:6006 accessible

Task 2: Install Dependencies and Setup Base Configuration
CREATE package.json additions:
  - ADD dependencies: @arizeai/phoenix-client @opentelemetry/api @opentelemetry/instrumentation
  - ADD dev dependencies: @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-proto
  - RUN: npm install

Task 3: Create Telemetry Module Structure
CREATE src/telemetry/phoenix-client.ts:
  - PATTERN from: scripts/monitoring-system.js initialization pattern
  - INITIALIZE Phoenix client with environment config
  - EXPORT singleton instance

CREATE src/telemetry/instrumentation.ts:
  - FOLLOW: https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/javascript
  - SETUP OpenTelemetry providers and exporters
  - CONFIGURE BatchSpanProcessor for production
  - SET endpoint to http://localhost:6006 (no auth needed)

Task 4: Implement MCP Instrumentation
CREATE src/telemetry/mcp-instrumentation.ts:
  - WRAP server.ts tool handlers with spans
  - TRACK request/response lifecycle
  - CAPTURE thought processing metrics
  - PRESERVE existing error handling

MODIFY src/server.ts:
  - IMPORT telemetry at top (after imports)
  - FIND pattern: "async handle(name: string, args: unknown)"
  - INJECT span creation around tool execution
  - ADD attributes: tool name, request ID, session

Task 5: Implement Cognitive Instrumentation
CREATE src/telemetry/cognitive-instrumentation.ts:
  - HOOK into CognitiveOrchestrator EventEmitter
  - TRACK plugin activation sequences
  - CAPTURE metacognitive metrics
  - MONITOR breakthrough events

MODIFY src/cognitive/cognitive-orchestrator.ts:
  - FIND pattern: "class CognitiveOrchestrator"
  - ADD telemetry event emissions
  - PRESERVE existing event patterns

Task 6: Database Instrumentation
CREATE src/telemetry/db-instrumentation.ts:
  - WRAP PostgreSQL query methods
  - TRACK query performance
  - MONITOR connection pool metrics

MODIFY src/memory/postgresql-memory-store.ts:
  - FIND pattern: "async query("
  - WRAP with span creation
  - ADD query attributes and timing

Task 7: Phoenix Dashboard Integration
CREATE src/telemetry/dashboard-launcher.ts:
  - UTILITY to start Phoenix UI
  - CUSTOM views configuration
  - EXPORT dashboard URL getter

Task 8: Prometheus Metrics Bridge
CREATE src/monitoring/phoenix-adapter.ts:
  - BRIDGE existing Prometheus metrics
  - CONVERT to Phoenix format
  - MAINTAIN backward compatibility

MODIFY src/monitoring/prometheus-metrics.ts:
  - ADD Phoenix export option
  - PRESERVE existing functionality

Task 9: Configuration Management
CREATE src/telemetry/telemetry-config.ts:
  - ENVIRONMENT variable management
  - FEATURE flags for selective instrumentation
  - SAMPLING rate configuration

MODIFY src/utils/config-manager.ts:
  - ADD telemetry configuration section
  - INTEGRATE with existing config system

Task 10: Testing and Validation
CREATE test/telemetry.test.ts:
  - UNIT tests for instrumentation wrappers
  - INTEGRATION tests with mock Phoenix
  - PERFORMANCE benchmarks

MODIFY existing tests:
  - ENSURE tests pass with telemetry enabled
  - ADD telemetry assertions where appropriate

Task 11: Documentation and Examples
CREATE docs/OBSERVABILITY.md:
  - SETUP instructions
  - DASHBOARD usage guide
  - TROUBLESHOOTING section

MODIFY README.md:
  - ADD observability section
  - LINK to detailed docs
```

### Per task pseudocode as needed added to each task

```typescript
// Task 1 - Phoenix Podman Configuration
// Addition to podman-compose.yml
services:
  phoenix:
    image: docker.io/arizephoenix/phoenix:latest-nonroot
    container_name: sentient-agi-phoenix
    ports:
      - "6006:6006"
    environment:
      # Share PostgreSQL with MCP server
      PHOENIX_SQL_DATABASE_URL: postgresql://mtd_user:p4ssw0rd@postgresql:5432/map_think_do
      PHOENIX_SQL_DATABASE_SCHEMA: phoenix  # Use separate schema
      PHOENIX_WORKING_DIR: /phoenix-data
    volumes:
      - phoenix_data:/phoenix-data:Z
    networks:
      - sentient-agi-network
    depends_on:
      - postgresql
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'

// Task 3 - Phoenix Client Initialization (Simplified for self-hosted)
// src/telemetry/phoenix-client.ts
import { PhoenixClient } from '@arizeai/phoenix-client';

class PhoenixTelemetryService {
  private client: PhoenixClient;
  private initialized = false;
  
  async initialize() {
    // PATTERN: Singleton initialization (see monitoring-system.js:66)
    if (this.initialized) return;
    
    // SIMPLIFIED: No auth needed for self-hosted
    const endpoint = process.env.PHOENIX_ENDPOINT || 'http://localhost:6006';
    
    this.client = new PhoenixClient({
      endpoint,
      // NO API KEY NEEDED for self-hosted!
      serviceName: 'sentient-agi-mcp-server',
    });
    
    this.initialized = true;
    console.error('✅ Phoenix telemetry initialized'); // CRITICAL: Use stderr
  }
}

// Task 4 - MCP Instrumentation wrapper
// src/telemetry/mcp-instrumentation.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export function instrumentMCPHandler(handler: Function, toolName: string) {
  const tracer = trace.getTracer('mcp-server');
  
  return async function instrumentedHandler(...args: any[]) {
    // PATTERN: Create span with semantic naming
    const span = tracer.startSpan(`mcp.tool.${toolName}`, {
      attributes: {
        'mcp.tool': toolName,
        'mcp.request_id': generateRequestId(), // Use existing ID generation
      }
    });
    
    // CRITICAL: Propagate context for nested spans
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await handler.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        // PATTERN: Preserve error handling (see server.ts error patterns)
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  };
}

// Task 5 - Cognitive Plugin Tracking
// src/telemetry/cognitive-instrumentation.ts
export class CognitiveInstrumentation {
  constructor(private orchestrator: CognitiveOrchestrator) {
    this.attachListeners();
  }
  
  private attachListeners() {
    // PATTERN: Non-invasive event subscription
    this.orchestrator.on('plugin:activated', (data) => {
      // GOTCHA: Check if span exists in current context
      const currentSpan = trace.getActiveSpan();
      if (currentSpan) {
        currentSpan.addEvent('cognitive.plugin.activated', {
          plugin: data.pluginName,
          persona: data.persona,
          confidence: data.confidence,
        });
      }
    });
    
    // PATTERN: Track breakthrough detection
    this.orchestrator.on('breakthrough:detected', (data) => {
      const span = trace.getTracer('cognitive').startSpan('cognitive.breakthrough');
      span.setAttributes({
        'cognitive.breakthrough_type': data.type,
        'cognitive.insight_potential': data.insightPotential,
      });
      span.end();
    });
  }
}
```

### Integration Points
```yaml
DATABASE:
  - Phoenix shares PostgreSQL with MCP server
  - Use schema separation to avoid conflicts:
    CREATE SCHEMA IF NOT EXISTS phoenix;
    CREATE SCHEMA IF NOT EXISTS mcp;
  - Phoenix tables isolated in phoenix schema

PODMAN:
  - add to: podman-compose.yml
  - Phoenix service with resource limits
  - Shared sentient-agi-network
  - Volume for Phoenix data persistence

CONFIG:
  - add to: src/utils/config-manager.ts
  - pattern: "telemetry: { enabled: boolean, endpoint: string, samplingRate: number }"
  
ENVIRONMENT:
  - add to: .env.example
  - PHOENIX_ENDPOINT=http://localhost:6006
  - TELEMETRY_ENABLED=true
  - TELEMETRY_SAMPLING_RATE=1.0
  # No API key needed for self-hosted!

INITIALIZATION:
  - modify: index.ts or server startup
  - pattern: "import './telemetry/instrumentation.js' // MUST be first"
  
MONITORING:
  - integrate: scripts/monitoring-system.js
  - pattern: "Add Phoenix export alongside console output"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                         # ESLint check
npm run format:check                  # Prettier check
npm run build                        # TypeScript compilation

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests for telemetry
```typescript
// CREATE test/telemetry.test.ts with these test cases:
describe('Phoenix Telemetry Integration', () => {
  test('telemetry initializes without errors', async () => {
    const telemetry = new PhoenixTelemetryService();
    await expect(telemetry.initialize()).resolves.not.toThrow();
  });

  test('MCP handler instrumentation preserves functionality', async () => {
    const handler = jest.fn().mockResolvedValue({ success: true });
    const instrumented = instrumentMCPHandler(handler, 'test-tool');
    
    const result = await instrumented('test-arg');
    expect(result).toEqual({ success: true });
    expect(handler).toHaveBeenCalledWith('test-arg');
  });

  test('telemetry overhead is under 5ms', async () => {
    const handler = async () => ({ data: 'test' });
    const instrumented = instrumentMCPHandler(handler, 'perf-test');
    
    const start = performance.now();
    await instrumented();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5);
  });
});
```

```bash
# Run and iterate until passing:
npm test test/telemetry.test.ts
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start Phoenix via Podman
podman-compose up -d phoenix

# Verify Phoenix is running
podman ps | grep phoenix
curl http://localhost:6006/health

# Start the MCP server with telemetry
TELEMETRY_ENABLED=true npm start

# Test MCP operations
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"code-reasoning","arguments":{"thought":"Test telemetry","thought_number":1,"total_thoughts":1,"next_thought_needed":false}},"id":1}' | npm start

# Verify in Phoenix UI
open http://localhost:6006

# Check resource usage
podman stats sentient-agi-phoenix

# Expected: Traces visible in Phoenix dashboard
# Expected: Memory usage < 2GB
# If error: Check logs with: podman logs sentient-agi-phoenix
```

### Level 4: Performance Validation
```bash
# Run performance benchmarks
npm run test:perf

# Compare baseline vs telemetry-enabled
TELEMETRY_ENABLED=false npm run test:perf > baseline.txt
TELEMETRY_ENABLED=true npm run test:perf > telemetry.txt
diff baseline.txt telemetry.txt

# Expected: <1ms additional latency (local network)
# Expected: <5% overall performance degradation

# Database schema validation
podman exec -it sentient-agi-postgresql psql -U mtd_user -d map_think_do -c "\dn"
# Expected: Separate 'phoenix' and 'public' schemas
```

## Final validation Checklist
- [ ] Phoenix container running: `podman ps | grep phoenix`
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No type errors: `npm run build`
- [ ] Phoenix dashboard accessible at http://localhost:6006
- [ ] Performance overhead <1ms verified (local network)
- [ ] Cognitive metrics visible in dashboard
- [ ] Database queries traced
- [ ] No database schema conflicts
- [ ] Phoenix memory usage < 2GB
- [ ] No stdout pollution (only stderr logging)
- [ ] Documentation updated
- [ ] Podman configuration tested

---

## Anti-Patterns to Avoid
- ❌ Don't log to stdout - breaks MCP protocol
- ❌ Don't create spans for every function - be selective
- ❌ Don't block on telemetry operations - use async
- ❌ Don't expose sensitive data in span attributes
- ❌ Don't ignore sampling configuration - respect rates
- ❌ Don't recreate telemetry clients - use singletons
- ❌ Don't inline telemetry code - use decorators/wrappers
- ❌ Don't skip performance validation - measure impact

## Confidence Score
**Score: 9.9/10**

Very high confidence due to:
- Self-hosting eliminates cloud authentication complexity
- Leverages existing Podman and PostgreSQL infrastructure
- Predictable local network performance (<1ms latency)
- Complete data privacy and control
- No external dependencies or API keys
- Clear integration points identified in codebase
- Existing monitoring infrastructure to build upon
- Well-defined validation criteria
- Minimal invasive changes required

Remaining minor uncertainties (-0.1) for:
- Phoenix container resource usage under sustained load (verifiable with testing)

✅ **Database Schema Validation Complete:**
- Successfully tested schema isolation between Phoenix and MCP
- Phoenix uses `phoenix` schema, MCP uses `public` schema
- No table name conflicts possible
- Both systems can coexist in same PostgreSQL instance
- Schema setup script created: `scripts/phoenix-schema-setup.sql`