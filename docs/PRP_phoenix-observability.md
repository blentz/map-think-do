# PRP: Enhanced Phoenix Observability for MCP Server

name: "Enhanced Phoenix Observability"
description: |

## Purpose

Plan to implement Phoenix observability enhancements. This is a plan to improve and fully implement observability integration from the MCP server to the existing Phoenix deployment.

## Core Principles

1. **Atomic Progress**: Each iteration completes ONE verifiable task
2. **Evidence Required**: No progress without test execution proof
3. **State Persistence**: Track progress between iterations in .state/
4. **Anti-Masturbation**: No self-congratulation without concrete results
5. **Validation First**: Test before declaring completion
6. **Global rules**: Follow all rules in CLAUDE.md
7. **Use Subagents**: Leverage the Task tool with appropriate subagent_type for complex operations

---

## Goal

Enhance the MCP Server to emit comprehensive observability information to Arize Phoenix, enabling detailed analysis and measurement of the MCP Server's impact on LLM operations. The implementation should follow Phoenix best practices for well-structured traces with rich metadata.

## Why

- **Visibility**: Gain deep insights into MCP Server operations and their effect on LLM behavior
- **Performance Analysis**: Measure and optimize the cognitive performance of the AGI system
- **Debugging**: Trace issues through the entire MCP-LLM interaction chain
- **Cost Tracking**: Monitor token usage and associated costs
- **Quality Assurance**: Enable evaluation and annotation of traces for continuous improvement

## What

Implement comprehensive Phoenix observability features including:

- Enhanced span attributes with prompt templates, variables, user/session tracking
- Well-structured trace hierarchies following OpenTelemetry best practices
- Phoenix-specific features like projects, annotations, and cost tracking
- LLM impact analysis metrics and dashboards
- Integration with existing cognitive metrics system

### Success Criteria

- [ ] All MCP operations emit properly structured traces to Phoenix
- [ ] Prompt templates and variables are tracked and visible in Phoenix UI
- [ ] User and session information is properly propagated through traces
- [ ] Parent-child span relationships accurately reflect operation hierarchy
- [ ] Cost tracking shows token usage and associated costs
- [ ] LLM impact metrics provide actionable insights
- [ ] No performance degradation (< 5% overhead)
- [ ] All tests pass with 100% coverage for new code

## Iteration State Management

### State Directory Structure

```bash
.state/
├── current_task.txt          # ID of task in progress
├── completed_tasks.txt       # List of completed task IDs
├── iteration_count.txt       # Current iteration number
├── task_manifest.yaml        # Complete task list with status
└── iteration_[N].log         # Log for each iteration
```

### Task Manifest Format

```yaml
tasks:
  - id: 'task_001'
    description: 'Create prompt template tracking module'
    status: 'completed'
    validation_passed: true
    test_output: 'All tests passed'
    completed_at: '2024-01-15T10:30:00Z'

  - id: 'task_002'
    description: 'Add user and session tracking'
    depends_on: ['task_001']
    status: 'in_progress'
    validation_passed: false
```

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- url: https://arize.com/docs/phoenix/tracing/how-to-tracing
  why: Core tracing documentation with setup and best practices

- url: https://arize.com/docs/phoenix/tracing/how-to-tracing/add-metadata/customize-spans
  why: How to add attributes, metadata, users to spans

- url: https://arize.com/docs/phoenix/tracing/how-to-tracing/add-metadata/instrumenting-prompt-templates-and-prompt-variables
  why: Specific guidance on prompt template tracking

- file: src/telemetry/mcp-instrumentation.ts
  why: Existing instrumentation patterns to follow and extend

- file: src/telemetry/phoenix-client.ts
  why: Current Phoenix client implementation to enhance

- file: src/monitoring/phoenix-adapter.ts
  why: Metrics bridge implementation to extend

- doc: https://github.com/Arize-ai/openinference/tree/main/spec/semantic_conventions.md
  section: Semantic conventions for span attributes
  critical: Use standard attribute names for interoperability
```

### Current Codebase tree

```bash
map-think-do/
├── src/
│   ├── telemetry/
│   │   ├── instrumentation.ts         # OpenTelemetry setup
│   │   ├── phoenix-client.ts          # Phoenix service client
│   │   ├── mcp-instrumentation.ts     # MCP handler instrumentation
│   │   ├── cognitive-instrumentation.ts # Cognitive metrics
│   │   ├── telemetry-config.ts        # Configuration
│   │   ├── types.ts                   # Type definitions
│   │   └── db-instrumentation.ts      # Database instrumentation
│   ├── monitoring/
│   │   ├── phoenix-adapter.ts         # Metrics bridge to Phoenix
│   │   └── prometheus-metrics.ts      # Prometheus exporter
│   ├── cognitive/
│   │   ├── cognitive-orchestrator.ts  # Main orchestrator
│   │   └── plugins/                   # Cognitive plugins
│   └── server.ts                      # Main server file
├── test/
│   └── telemetry/
└── package.json
```

### Desired Codebase tree with files to be added

```bash
map-think-do/
├── src/
│   ├── telemetry/
│   │   ├── instrumentation.ts         # (enhance with BatchSpanProcessor)
│   │   ├── phoenix-client.ts          # (enhance with new methods)
│   │   ├── mcp-instrumentation.ts     # (enhance with prompt tracking)
│   │   ├── cognitive-instrumentation.ts # (enhance with LLM metrics)
│   │   ├── prompt-tracking.ts         # NEW: Prompt template management
│   │   ├── context-attributes.ts      # NEW: Context attribute helpers
│   │   └── llm-impact-metrics.ts      # NEW: LLM impact analysis
│   ├── monitoring/
│   │   └── phoenix-adapter.ts         # (enhance with new metrics)
│   └── server.ts                      # (integrate new features)
├── test/
│   └── telemetry/
│       ├── phoenix-integration.test.ts # NEW: Integration tests
│       ├── prompt-tracking.test.ts    # NEW: Prompt tracking tests
│       └── llm-impact.test.ts         # NEW: Impact metrics tests
└── docs/
    ├── PHOENIX_STATUS.md               # NEW: Implementation status
    └── PHOENIX_METRICS.md              # NEW: Metrics documentation
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: Phoenix requires specific attribute formats
// Example: Prompt template variables must be JSON serialized
span.setAttribute('llm.prompt_template.variables', JSON.stringify(variables));

// CRITICAL: Use BatchSpanProcessor in production for performance
// SimpleSpanProcessor is only for development/debugging

// CRITICAL: Context propagation requires proper async handling
// Always use context.with() for attribute propagation

// CRITICAL: Phoenix endpoint must include /v1/traces for OTLP
// Example: http://localhost:6006/v1/traces

// CRITICAL: PostgreSQL database credentials are as follows
// User: mtd_user
// PGPASSWORD: p4ssw0rd
```

## Implementation Blueprint

### Data models and structure

```typescript
// src/telemetry/types.ts - Extend existing types
export interface PromptTemplate {
  template: string;
  version: string;
  variables: Record<string, any>;
}

export interface LLMImpactMetrics {
  thoughtLatency: number;
  tokenCount: number;
  cost: number;
  confidenceScore: number;
  breakthroughLikelihood: number;
}

// src/telemetry/context-attributes.ts
export interface ContextAttributes {
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  promptTemplate?: PromptTemplate;
}
```

### Atomic Task List (ONE per iteration)

```yaml
Task 001:
  id: 'task_001'
  description: 'Create prompt template tracking module'
  atomic_scope: |
    - CREATE src/telemetry/prompt-tracking.ts
    - Define PromptTemplate interface
    - Implement setPromptTemplate function
    - Export context helpers
  validation_required:
    - 'npm run build'
    - 'npm run test -- prompt-tracking'
  estimated_time: '15 minutes'

Task 002:
  id: 'task_002'
  description: 'Integrate prompt tracking with MCP instrumentation'
  depends_on: ['task_001']
  atomic_scope: |
    - MODIFY src/telemetry/mcp-instrumentation.ts
    - Import prompt tracking helpers
    - Add prompt attributes to spans
    - Test with code-reasoning tool
  validation_required:
    - 'npm run build'
    - "curl -X POST http://localhost:3000/mcp -d '{test}'"
    - 'Verify attributes in Phoenix UI'

Task 003:
  id: 'task_003'
  description: 'Add user and session tracking'
  depends_on: ['task_002']
  atomic_scope: |
    - CREATE src/telemetry/context-attributes.ts
    - Implement setUser and setSession functions
    - Add to MCP instrumentation
  validation_required:
    - 'npm run build'
    - 'npm test'
    - 'Check Phoenix UI for user/session attributes'

Task 004:
  id: 'task_004'
  description: 'Enhance metadata and tags support'
  depends_on: ['task_003']
  atomic_scope: |
    - MODIFY src/telemetry/context-attributes.ts
    - Add setMetadata and setTags functions
    - Integrate with existing spans
  validation_required:
    - 'npm run build'
    - 'npm test'

Task 005:
  id: 'task_005'
  description: 'Improve parent-child span relationships'
  depends_on: ['task_004']
  atomic_scope: |
    - MODIFY src/telemetry/mcp-instrumentation.ts
    - Ensure proper span nesting
    - Add span links where appropriate
  validation_required:
    - 'npm run build'
    - 'Verify trace hierarchy in Phoenix UI'

Task 006:
  id: 'task_006'
  description: 'Add semantic conventions'
  depends_on: ['task_005']
  atomic_scope: |
    - MODIFY src/telemetry/mcp-instrumentation.ts
    - Use OpenInference semantic conventions
    - Standardize attribute names
  validation_required:
    - 'npm run build'
    - 'npm test'

Task 007:
  id: 'task_007'
  description: 'Implement project tracking'
  depends_on: ['task_006']
  atomic_scope: |
    - MODIFY src/telemetry/telemetry-config.ts
    - Add project name configuration
    - Update tracer initialization
  validation_required:
    - 'npm run build'
    - 'Verify project in Phoenix UI'

Task 008:
  id: 'task_008'
  description: 'Add cost tracking attributes'
  depends_on: ['task_007']
  atomic_scope: |
    - MODIFY src/telemetry/mcp-instrumentation.ts
    - Add token count attributes
    - Calculate and add cost estimates
  validation_required:
    - 'npm run build'
    - 'Verify costs in Phoenix UI'

Task 009:
  id: 'task_009'
  description: 'Create LLM impact metrics module'
  depends_on: ['task_008']
  atomic_scope: |
    - CREATE src/telemetry/llm-impact-metrics.ts
    - Define impact metric types
    - Implement calculation functions
  validation_required:
    - 'npm run build'
    - 'npm test'

Task 010:
  id: 'task_010'
  description: 'Integrate impact metrics with Phoenix adapter'
  depends_on: ['task_009']
  atomic_scope: |
    - MODIFY src/monitoring/phoenix-adapter.ts
    - Export LLM impact metrics
    - Add to metrics bridge
  validation_required:
    - 'npm run build'
    - 'Check metrics in Phoenix dashboard'

Task 011:
  id: 'task_011'
  description: 'Create Phoenix integration tests'
  depends_on: ['task_010']
  atomic_scope: |
    - CREATE test/telemetry/phoenix-integration.test.ts
    - Test trace export
    - Verify attribute propagation
  validation_required:
    - 'npm test -- phoenix-integration'

Task 012:
  id: 'task_012'
  description: 'Add prompt tracking tests'
  depends_on: ['task_011']
  atomic_scope: |
    - CREATE test/telemetry/prompt-tracking.test.ts
    - Test template tracking
    - Test variable substitution
  validation_required:
    - 'npm test -- prompt-tracking'

Task 013:
  id: 'task_013'
  description: 'Performance validation'
  depends_on: ['task_012']
  atomic_scope: |
    - CREATE test/telemetry/performance.test.ts
    - Measure overhead
    - Ensure < 5% performance impact
  validation_required:
    - 'npm test -- performance'
    - 'Performance report generated'

Task 014:
  id: 'task_014'
  description: 'Update documentation'
  depends_on: ['task_013']
  atomic_scope: |
    - CREATE docs/PHOENIX_METRICS.md
    - Document all metrics
    - Add usage examples
  validation_required:
    - 'File exists and is complete'

Task 015:
  id: 'task_015'
  description: 'Final integration test'
  depends_on: ['task_014']
  atomic_scope: |
    - Run full test suite
    - Verify all features in Phoenix UI
    - Generate coverage report
  validation_required:
    - 'npm test'
    - 'npm run coverage'
    - 'All tests pass with 100% coverage'
```

### Per-Task Implementation Guide

```typescript
// Task 001: Create prompt template tracking module
// src/telemetry/prompt-tracking.ts
import { context } from '@opentelemetry/api';

export interface PromptTemplate {
  template: string;
  version: string;
  variables: Record<string, any>;
}

const PROMPT_TEMPLATE_KEY = Symbol('prompt_template');

export function setPromptTemplate(ctx: Context, template: PromptTemplate): Context {
  return ctx.setValue(PROMPT_TEMPLATE_KEY, template);
}

export function getPromptTemplate(ctx: Context): PromptTemplate | undefined {
  return ctx.getValue(PROMPT_TEMPLATE_KEY) as PromptTemplate | undefined;
}

export function withPromptTemplate<T>(template: PromptTemplate, fn: () => T): T {
  return context.with(setPromptTemplate(context.active(), template), fn);
}

// Task 002: Integration with MCP instrumentation
// Will modify existing instrumentMCPHandler to include:
const promptTemplate = getPromptTemplate(context.active());
if (promptTemplate) {
  span.setAttribute('llm.prompt_template.template', promptTemplate.template);
  span.setAttribute('llm.prompt_template.version', promptTemplate.version);
  span.setAttribute('llm.prompt_template.variables', JSON.stringify(promptTemplate.variables));
}
```

## Iteration Validation Protocol

### Pre-Iteration Checks

```bash
# Verify state consistency
cat .state/current_task.txt
cat .state/iteration_count.txt

# Ensure clean working directory
git status

# Verify Phoenix is running
curl http://localhost:6006/health
```

### During Iteration Validation

```bash
# Level 1: TypeScript compilation
npm run build

# Level 2: Type checking
npm run typecheck

# Level 3: Unit tests
npm test -- --testPathPattern=<task_name>

# Level 4: Integration test
# Start server and send test request
npm start &
sleep 5
curl -X POST http://localhost:3000/mcp -d '{"test": true}'

# Level 5: Verify in Phoenix UI
# Open http://localhost:6006 and check for traces
```

### Post-Task Validation (REQUIRED before marking complete)

```bash
# Run specific task tests
npm test -- --testPathPattern=task_<ID>

# Verify Phoenix receives data
curl http://localhost:6006/v1/traces

# If test passes, update state:
echo "task_<ID>" >> .state/completed_tasks.txt
```

### Iteration Exit Criteria

```yaml
PASS:
  - TypeScript compilation successful
  - All tests pass
  - Phoenix UI shows expected traces/attributes
  - No performance regression
  - State files updated

FAIL:
  - Fix errors in current iteration
  - Do NOT move to next task
  - Do NOT declare partial success
  - Log specific error for debugging
```

## Anti-Pattern Detection

### Red Flags (STOP if you're doing these)

```typescript
// ❌ WRONG: Placeholder implementation
export function trackPrompt() {
  // TODO: implement later
  console.log('Tracking prompt');
}

// ✅ RIGHT: Functional implementation
export function trackPrompt(template: PromptTemplate): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('llm.prompt_template.template', template.template);
    span.setAttribute('llm.prompt_template.version', template.version);
    span.setAttribute('llm.prompt_template.variables', JSON.stringify(template.variables));
  }
}

// ❌ WRONG: Skipping validation
// "Phoenix will receive the traces"

// ✅ RIGHT: Always verify
const response = await fetch('http://localhost:6006/v1/traces');
assert(response.ok, 'Phoenix endpoint accessible');

// ❌ WRONG: Mock implementations
const mockPhoenixClient = { send: () => Promise.resolve() };

// ✅ RIGHT: Real integration
import { PhoenixTelemetryService } from './phoenix-client';
const phoenixService = PhoenixTelemetryService.getInstance();
```

### Oversimplification Triggers

- Using console.log instead of proper span attributes
- Hardcoding values that should be dynamic
- Removing error handling for "simplicity"
- Creating mock Phoenix clients
- Using setTimeout instead of proper async handling
- Skipping validation "because it should work"

## Final Validation Checklist (Per Iteration)

- [ ] Current task test passes: `npm test -- task_<ID>`
- [ ] No TypeScript errors: `npm run build`
- [ ] No type errors: `npm run typecheck`
- [ ] Phoenix receives traces: Check UI at http://localhost:6006
- [ ] Attributes visible in spans: Verify in Phoenix UI
- [ ] State files updated: `.state/` reflects progress
- [ ] No placeholder code remains
- [ ] No untested code paths
- [ ] Performance impact < 5%

## Emergency Stop Conditions

If ANY of these occur, STOP and ask for user intervention:

1. Phoenix endpoint unreachable after 3 attempts
2. Performance degradation > 5%
3. Breaking changes to existing functionality
4. Security vulnerability introduced
5. Circular dependency detected

---

## Continuous Execution Command

Run this in your terminal:

```bash
# Initialize state
mkdir -p .state
echo "task_001" > .state/current_task.txt
echo "0" > .state/iteration_count.txt

# Ensure Phoenix is running
docker run -p 6006:6006 arizephoenix/phoenix:latest

# Run continuous loop with developer subagent
while true; do
  opencode -m claude-3-5-sonnet-20241022 run "Use Task tool with subagent_type='developer' to execute: $(cat LOOP.md)"
  sleep 60
done
```

## Success Metrics

- Iterations with test failures: 0
- Placeholder code instances: 0
- Untested code paths: 0
- State consistency errors: 0
- Performance regression: < 5%
- Phoenix trace visibility: 100%
