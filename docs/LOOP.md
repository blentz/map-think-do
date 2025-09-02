# Iterative Implementation Loop Instructions for Phoenix Observability Enhancement

## READ-ONLY LOOP.md

This file is READ-ONLY. DO NOT MODIFY LOOP.md.

## Core Project Files (READ FIRST EVERY LOOP)

- docs/PRP_phoenix-observability.md

## Context Management Rules

- **STOP WORKING at 75% context usage** to preserve quality
- Check context with periodic self-assessment
- If approaching limit, finalize current work and update status

## Session Structure

### 1. START: Understand Current State

First, read the core project files, then check the git history and read the current status:

```bash
git log --oneline -5
git log --stat -p HEAD
```

Then read the current implementation status:

```bash
cat docs/PHOENIX_STATUS.md
```

If docs/PHOENIX_STATUS.md doesn't exist, initialize it with:

```
# Implementation Status

## Current Phase
Phase 1: Enhanced Span Attributes

## Current Session
Session 1: Add prompt template tracking

## Completed Sessions
None

## Next Steps
- Implement prompt template context manager
- Add user and session tracking
- Enhance metadata attributes

## Notes
Starting implementation of Phoenix observability enhancements for MCP Server
```

### 2. PREPARE: Scan the previous session's work for bullshit. REQUIRED FOR EVERY LOOP.

Use the bullshit-detector sub-agent to assess whether the previous iteration did usable work. Do not move to a new phase of the project until the current phase is correctly implemented. 

### 3. EXECUTE: Perform Current Session Work

Based on the current session indicated in docs/PHOENIX_STATUS.md, execute the appropriate work:

#### Session Pattern (5-session cycle per feature):

1. **SPECIFY** - Use @task with requirements-analyst to define requirements
2. **DESIGN** - Use @task with system-architect to design architecture
3. **IMPLEMENT** - Use @task with developer to write code
4. **VALIDATE** - Use @task with qa-engineer to test
5. **OPTIMIZE** - Use @task with maintenance-support to optimize

#### Anti-Oversimplification Requirements

Permission to simplify problems is **DENIED**. The user must give you explicit approval before you are allowed to avoid complex problems.

**CRITICAL**: You do not have permission to:

- implement "simple" solutions
- create "demo" or "demonstration" code
- create "simple" tests or validations
- create new "clean" versions of anything. Two nonfunctional versions is two failures. Fix what's here, don't create double the mess.
- use "realistic" data. Realistic is fake, not real.
- create "mock" implementations. Mocking is only valid in unit tests.
- using alternative approaches not in the PRP
- change goals or redefine success. The only valid definition of success is the one the user gave.
- using random functions of any kind. Using Math.random() is ALWAYS a failure. Every time you use Math.random, you must immediately engage the bullshit-detector subagent to analyze the project.

Remember: Partially implemented solutions that can be iterated upon in a future iteration loop are ALLOWED. Incomplete high complexity work is always better than arriving at a wrong answer quickly. Fast solutions are always failures. Take as many iterations as necessary to complete the task correctly.

### When a problem is too complex ALWAYS do this instead of simplifying:

1. Immediately stop implementing and return to planning.
2. Break down the complex problem into smaller tasks.
3. Recursively plan and break complex problems down until tasks are simple enough for you to solve correctly within the context window.
4. Use the docs/PHOENIX_STATUS.md to document your task breakdowns and progress at implementation. 

Remember: small, slow, correct progress toward the goal is far better than being fast and incorrect.

#### Implementation Priorities

1. Add prompt template and variable tracking to spans
2. Implement user, session, and metadata attributes
3. Enhance trace structure with proper parent-child relationships
4. Add Phoenix-specific features (projects, annotations, costs)
5. Create LLM impact analysis metrics and dashboards

#### Code Location Structure

```
.map-think-do/
├── docs/  # Put all documentation here
├── tests/ # Put all test or validation code here
├── logs/  # Write all logs here
├── src/  # ONLY application code in here
│   ├── telemetry/
│   │   ├── phoenix-client.ts (existing - enhance)
│   │   ├── mcp-instrumentation.ts (existing - enhance)
│   │   ├── cognitive-instrumentation.ts (existing - enhance)
│   │   ├── prompt-tracking.ts (new)
│   │   └── llm-impact-metrics.ts (new)
│   └── monitoring/
│       └── phoenix-adapter.ts (existing - enhance)
└── ...
```

### 4. WORK: Implementation Guidelines

Use mcp\_\_sentient-agi-reasoning to help plan the session work. Follow these patterns:

```typescript
// Use OpenTelemetry context for attribute propagation
import { context, trace, SpanKind } from '@opentelemetry/api';

// Follow existing patterns from mcp-instrumentation.ts
// Use semantic conventions for attributes
// Implement proper error handling and logging
```

### 5. TEST: Validation Requirements

For each implementation:

1. TypeScript compilation: npm run build
2. Unit tests pass: npm test
3. Phoenix receives traces: Check http://localhost:6006
4. Attributes visible in Phoenix UI
5. No performance regression

### 6. FINISH: Update Status and Commit

Before ending the session:

1. Remove status from sessions older than the last 5 iterations unless the information is still relevant.
2. Update docs/PHOENIX_STATUS.md with:
   - Work completed in this session
   - Current phase and session number
   - Next session's objectives
   - Any blockers or issues
   - Context usage estimate

3. Example status update:

```markdown
# Implementation Status

## Current Phase

Phase 1: Enhanced Span Attributes

## Current Session

Session 2: User and session tracking

## Completed Sessions

- Session 1: Prompt template tracking
  - Created prompt-tracking.ts module
  - Integrated with MCP instrumentation
  - Verified attributes in Phoenix UI

## Next Steps

- Add user ID tracking to spans
- Implement session management
- Add metadata attributes

## Blockers

None

## Context Usage

Approximately 35% - continuing with implementation

## Notes

- Prompt templates successfully tracked
- Attributes visible in Phoenix UI
- Ready for user/session implementation
```

4. Commit your work:

```bash
git add -A
git commit -m "feat(telemetry): implement [specific feature] for session N

- Add [specific functionality]
- Include [specific tests]
- Document [specific aspects]

Part of Phoenix observability enhancement"
```

### 6. EXIT: Context Preservation

If context usage exceeds 75%:

1. Stop immediately
2. Document stopping point in docs/PHOENIX_STATUS.md
3. Note any partial work that needs completion
4. Commit all changes
5. Exit the session

## Session Phases Overview

### Phase 1: Enhanced Span Attributes (Sessions 1-3)

- Add prompt template and variable tracking
- Implement user and session tracking
- Add metadata and tags

### Phase 2: Improved Trace Structure (Sessions 4-6)

- Enhance parent-child relationships
- Add semantic conventions
- Implement events and status codes

### Phase 3: Phoenix-Specific Features (Sessions 7-9)

- Add project tracking
- Implement annotation support
- Enable cost tracking

### Phase 4: LLM Impact Analysis (Sessions 10-12)

- Create impact metrics
- Build analysis dashboards
- Implement evaluation tracking

### Phase 5: Testing & Validation (Sessions 13-15)

- Comprehensive integration tests
- Performance validation
- Documentation updates

## Remember

- This file is STATELESS - all state tracking happens in docs/PHOENIX_STATUS.md
- Stop at 75% context to maintain quality
- Check Phoenix UI after each implementation
- Verify traces are properly structured
- Monitor performance impact
- Use mcp\_\_sentient-agi-reasoning for complex decisions
- Commit frequently with descriptive messages
