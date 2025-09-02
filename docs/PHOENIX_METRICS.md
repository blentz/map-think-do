# Phoenix Observability Metrics

This document describes all metrics, attributes, and events tracked by the Sentient AGI Reasoning Server for Phoenix observability.

## Overview

The Phoenix observability system tracks comprehensive metrics across multiple dimensions:

- **Cognitive Performance**: LLM reasoning effectiveness and quality metrics
- **Tool Execution**: MCP tool invocation and performance data
- **System Performance**: Database, memory, and infrastructure metrics
- **Cost Analysis**: Token usage and associated costs
- **User Context**: Session, user, and metadata tracking

## Span Attributes

### Core MCP Attributes

| Attribute                 | Type   | Description                             | Example                        |
| ------------------------- | ------ | --------------------------------------- | ------------------------------ |
| `mcp.tool`                | string | Name of the MCP tool being executed     | `code-reasoning`               |
| `mcp.request_id`          | string | Unique identifier for the MCP request   | `req_abc123`                   |
| `mcp.session_id`          | string | Session identifier for request grouping | `sess_xyz789`                  |
| `openinference.span.kind` | string | OpenInference span type                 | `TOOL`                         |
| `tool.name`               | string | Tool name (OpenInference convention)    | `code-reasoning`               |
| `tool.description`        | string | Tool description                        | `Advanced cognitive reasoning` |

### LLM-Specific Attributes

| Attribute                       | Type   | Description                      | Example                          |
| ------------------------------- | ------ | -------------------------------- | -------------------------------- |
| `llm.model_name`                | string | Model identifier                 | `mcp-sentient-agi`               |
| `llm.provider`                  | string | LLM provider                     | `anthropic-mcp`                  |
| `llm.token_count.prompt`        | number | Input token count                | `150`                            |
| `llm.token_count.completion`    | number | Output token count               | `300`                            |
| `llm.token_count.total`         | number | Total token count                | `450`                            |
| `llm.prompt_template.template`  | string | Prompt template used             | `Analyze this code: {code}`      |
| `llm.prompt_template.version`   | string | Template version                 | `v1.2.0`                         |
| `llm.prompt_template.variables` | string | JSON serialized variables        | `{"code": "function test() {}"}` |
| `llm.prompt_variables`          | string | JSON serialized prompt variables | `{"input": "value"}`             |
| `llm.prompt_variables.count`    | number | Number of prompt variables       | `3`                              |

### Cognitive Metrics Attributes

| Attribute                           | Type   | Description                 | Range   | Example                |
| ----------------------------------- | ------ | --------------------------- | ------- | ---------------------- |
| `cognitive.persona`                 | string | Active cognitive persona    | -       | `strategist`           |
| `cognitive.metacognitive_awareness` | number | Self-reflection depth       | 0.0-1.0 | `0.85`                 |
| `cognitive.creative_pressure`       | number | Innovation potential        | 0.0-1.0 | `0.72`                 |
| `cognitive.breakthrough_likelihood` | number | Discovery probability       | 0.0-1.0 | `0.68`                 |
| `cognitive.insight_potential`       | number | Eureka moment probability   | 0.0-1.0 | `0.91`                 |
| `cognitive.thought_number`          | number | Current thought in sequence | 1+      | `5`                    |
| `cognitive.total_thoughts`          | number | Expected total thoughts     | 1+      | `8`                    |
| `cognitive.plugin`                  | string | Active cognitive plugin     | -       | `metacognitive-plugin` |
| `cognitive.event_type`              | string | Type of cognitive event     | -       | `breakthrough`         |

### LLM Impact Metrics Attributes

| Attribute                                  | Type   | Description                     | Range   | Example |
| ------------------------------------------ | ------ | ------------------------------- | ------- | ------- |
| `llm.impact.cognitive_efficiency`          | number | Cognitive processing efficiency | 0.0-1.0 | `0.87`  |
| `llm.impact.thought_quality`               | number | Quality of reasoning            | 0.0-1.0 | `0.93`  |
| `llm.impact.learning_velocity`             | number | Learning progression rate       | 0.0-1.0 | `0.76`  |
| `llm.impact.conceptual_depth`              | number | Depth of understanding          | 0.0-1.0 | `0.84`  |
| `llm.impact.problem_solving_effectiveness` | number | Problem resolution capability   | 0.0-1.0 | `0.91`  |
| `llm.impact.confidence_score`              | number | System confidence level         | 0.0-1.0 | `0.78`  |
| `llm.impact.breakthrough_likelihood`       | number | Innovation potential            | 0.0-1.0 | `0.65`  |

### Context Attributes

| Attribute     | Type   | Description             | Example                       |
| ------------- | ------ | ----------------------- | ----------------------------- |
| `user.id`     | string | User identifier         | `user_123`                    |
| `session.id`  | string | Session identifier      | `session_abc`                 |
| `project.id`  | string | Project identifier      | `sentient-agi-reasoning`      |
| `environment` | string | Environment name        | `production`                  |
| `version`     | string | System version          | `1.0.0`                       |
| `tag.tags`    | string | JSON array of tags      | `["experiment", "reasoning"]` |
| `metadata`    | string | JSON object of metadata | `{"complexity": "high"}`      |

### Database Attributes

| Attribute          | Type   | Description             | Example                           |
| ------------------ | ------ | ----------------------- | --------------------------------- |
| `db.system`        | string | Database system         | `postgresql`                      |
| `db.name`          | string | Database name           | `memory_store`                    |
| `db.operation`     | string | Database operation      | `SELECT`                          |
| `db.statement`     | string | Sanitized SQL statement | `SELECT * FROM memories WHERE...` |
| `db.rows_affected` | number | Number of rows affected | `5`                               |
| `db.rows_returned` | number | Number of rows returned | `10`                              |
| `db.duration_ms`   | number | Operation duration      | `25`                              |
| `db.pool.size`     | number | Connection pool size    | `20`                              |
| `db.pool.active`   | number | Active connections      | `5`                               |
| `db.pool.idle`     | number | Idle connections        | `15`                              |

### Input/Output Attributes (OpenInference)

| Attribute          | Type   | Description          | Example                     |
| ------------------ | ------ | -------------------- | --------------------------- |
| `input.value`      | string | Request input data   | `{"thought": "Analyze..."}` |
| `input.mime_type`  | string | Input content type   | `application/json`          |
| `output.value`     | string | Response output data | `{"result": "Analysis..."}` |
| `output.mime_type` | string | Output content type  | `application/json`          |

## Span Events

### Cognitive Events

| Event Name                 | Description                    | Attributes                                                 |
| -------------------------- | ------------------------------ | ---------------------------------------------------------- |
| `cognitive.process`        | Cognitive processing milestone | `phase`, `thought_number`, `duration_ms`, `success`        |
| `cognitive.breakthrough`   | Significant insight detected   | `insight_type`, `confidence`, `impact_score`               |
| `cognitive.branch.created` | Reasoning branch created       | `branch_id`, `parent_thought`, `reason`                    |
| `cognitive.revision.made`  | Thought revision applied       | `original_thought`, `revised_thought`, `improvement_score` |

### Tool Events

| Event Name                     | Description                       | Attributes                                         |
| ------------------------------ | --------------------------------- | -------------------------------------------------- |
| `tool.execution`               | Tool execution milestone          | `tool_name`, `phase`, `duration_ms`, `success`     |
| `prompt.template.applied`      | Prompt template applied           | `template_id`, `variable_count`, `expansion_ratio` |
| `prompt.variables.substituted` | Variables substituted in template | `variable_names`, `substitution_count`             |

### Memory Events

| Event Name                | Description               | Attributes                                          |
| ------------------------- | ------------------------- | --------------------------------------------------- |
| `memory.operation`        | Memory system operation   | `operation_type`, `key`, `duration_ms`, `cache_hit` |
| `memory.pattern.detected` | Pattern recognition event | `pattern_type`, `confidence`, `relevance_score`     |

### Cost Events

| Event Name                  | Description             | Attributes                                             |
| --------------------------- | ----------------------- | ------------------------------------------------------ |
| `cost.token_usage`          | Token usage summary     | `prompt_tokens`, `completion_tokens`, `total_cost_usd` |
| `cost.optimization.applied` | Cost optimization event | `strategy`, `savings_percent`, `tokens_saved`          |

### User Context Events

| Event Name             | Description             | Attributes                                        |
| ---------------------- | ----------------------- | ------------------------------------------------- |
| `user.session.started` | User session initiated  | `user_id`, `session_type`, `context_data`         |
| `user.identification`  | User context identified | `user_id`, `authentication_method`, `permissions` |

## Phoenix Dashboard Metrics

### Real-Time Metrics

The following metrics are exported to Phoenix dashboards:

| Metric Name                     | Type      | Description                             | Unit          |
| ------------------------------- | --------- | --------------------------------------- | ------------- |
| `cognitive_efficiency`          | gauge     | Overall cognitive processing efficiency | percentage    |
| `thought_quality`               | gauge     | Average quality of reasoning            | score (0-1)   |
| `learning_velocity`             | gauge     | Rate of learning progression            | velocity      |
| `conceptual_depth`              | gauge     | Average depth of understanding          | depth score   |
| `problem_solving_effectiveness` | gauge     | Problem resolution success rate         | percentage    |
| `confidence_score`              | gauge     | System confidence level                 | score (0-1)   |
| `breakthrough_likelihood`       | gauge     | Innovation potential                    | probability   |
| `token_usage_rate`              | counter   | Total tokens processed                  | tokens/second |
| `cost_per_session`              | histogram | Cost distribution per session           | USD           |
| `response_latency`              | histogram | Response time distribution              | milliseconds  |

### Historical Metrics

Aggregated metrics available for trend analysis:

| Metric                       | Aggregation Period | Description                               |
| ---------------------------- | ------------------ | ----------------------------------------- |
| `daily_cognitive_efficiency` | 24 hours           | Daily average cognitive efficiency        |
| `weekly_breakthrough_count`  | 7 days             | Number of breakthrough insights per week  |
| `monthly_cost_trend`         | 30 days            | Monthly cost progression and optimization |
| `session_quality_trend`      | 1 hour             | Rolling quality improvements              |

## Usage Examples

### Setting User Context

```typescript
import { setUserInfo, setSessionInfo, withFullContext } from './context-attributes.js';

const userInfo = { userId: 'user_123', role: 'researcher' };
const sessionInfo = { sessionId: 'sess_abc', type: 'analysis' };

withFullContext(userInfo, sessionInfo, {}, ctx => {
  // Operations within this context will have user/session attributes
});
```

### Adding Prompt Template Tracking

```typescript
import { withPromptTemplate } from './prompt-tracking.js';

const template = {
  template: 'Analyze this code: {code}',
  version: 'v1.2.0',
  variables: { code: 'function test() {}' },
};

withPromptTemplate(template, () => {
  // Operations will include prompt template attributes
});
```

### Recording Cognitive Events

```typescript
import { EventManager, EventType } from './event-manager.js';

const eventManager = new EventManager();

eventManager.recordCognitiveEvent(span, {
  phase: 'process',
  thoughtNumber: 3,
  duration: 150,
  success: true,
  insights: ['Key insight discovered'],
});
```

## Configuration

### Environment Variables

| Variable                | Description                | Default                           |
| ----------------------- | -------------------------- | --------------------------------- |
| `PHOENIX_ENDPOINT`      | Phoenix collector endpoint | `http://localhost:6006/v1/traces` |
| `PHOENIX_PROJECT_NAME`  | Project name in Phoenix    | `sentient-agi-reasoning`          |
| `PHOENIX_SAMPLING_RATE` | Trace sampling rate        | `1.0`                             |
| `TELEMETRY_ENABLED`     | Enable/disable telemetry   | `true`                            |

### Sampling Configuration

The system uses deterministic sampling based on request hashes to ensure reproducible behavior while managing volume.

```typescript
// Hash-based sampling (default)
samplingStrategy: 'hash',
samplingRate: 1.0, // 100% sampling

// Counter-based sampling
samplingStrategy: 'counter',
samplingRate: 0.1 // 10% sampling
```

## Performance Impact

The telemetry system is designed for minimal performance impact:

- **Overhead**: < 5% CPU overhead under normal load
- **Memory**: < 1MB memory usage per 1000 spans
- **Latency**: < 1ms additional latency per span (P95: < 2ms)
- **Throughput**: Supports 1000+ spans/second

## Troubleshooting

### Common Issues

1. **Missing Attributes**: Verify context propagation is working correctly
2. **High Memory Usage**: Check for proper span cleanup and batching
3. **Performance Degradation**: Reduce sampling rate or disable detailed attributes
4. **Phoenix Connection**: Verify endpoint URL and network connectivity

### Debug Mode

Enable debug logging to troubleshoot telemetry issues:

```bash
export DEBUG_TELEMETRY=true
npm start
```

This will output detailed information about span creation, attribute setting, and event recording.
