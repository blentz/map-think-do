# CLI Reference & NPM Scripts

Complete reference for command-line tools and NPM scripts available in the Sentient AGI Reasoning Server.

## NPM Scripts Reference

### Core Development Scripts

```bash
# Build and Development
npm run build          # Compile TypeScript and make binaries executable  
npm run clean          # Remove dist directory
npm run clean:build    # Clean and rebuild from scratch
npm run dev            # Watch mode for development
npm start              # Run the compiled server
npm run debug          # Run server with debug logging

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues automatically
npm run format         # Format code with Prettier
npm run format:check   # Check if code is properly formatted
npm run validate       # Format, lint, and build in sequence
```

### Testing Scripts

```bash
# Basic Testing
npm test               # Run basic end-to-end tests
npm run test:all       # Run comprehensive test suite
npm run test:basic     # Basic reasoning tests
npm run test:branch    # Branching logic tests
npm run test:revision  # Revision capability tests
npm run test:error     # Error handling tests
npm run test:perf      # Performance tests
npm run test:unit      # Unit tests only
npm run test:validate  # Format, lint, and test
npm run test:verbose   # Verbose test output
npm run test:memory    # PostgreSQL memory store tests

# Specialized Testing
npm run agi-demo       # Demonstrate AGI capabilities
```

### Database Management Scripts

```bash
# Database Lifecycle
npm run db:start       # Start PostgreSQL container
npm run db:stop        # Stop PostgreSQL container  
npm run db:restart     # Restart PostgreSQL container
npm run db:status      # Check container status
npm run db:logs        # View database logs
npm run db:clean       # Clean database data and restart
```

### Performance Tuning Scripts

```bash
# Quick Access
npm run tune           # Show current performance configuration
npm run tune:show      # Show current performance configuration

# Performance Modes
npm run tune:high      # Set high-performance mode
npm run tune:balanced  # Set balanced mode (default)
npm run tune:eco       # Set eco mode

# Configuration Management
npm run tune:reset     # Reset to optimal values for system
npm run tune:env       # Generate environment variables
npm run tune:benchmark # Show performance calculations
npm run tune:help      # Show tuning help
```

### Evaluation Scripts

```bash
# Prompt Evaluation System
npm run eval           # Run prompt evaluation system
npm run eval:view      # View evaluation results
npm run reset:evaluations  # Clear evaluation reports
```

## Cognitive Tuning CLI Tool

The `./scripts/cognitive-tuning.js` tool provides comprehensive performance configuration management.

### Basic Usage

```bash
# Make executable (if needed)
chmod +x ./scripts/cognitive-tuning.js

# Show help
./scripts/cognitive-tuning.js help

# Show current configuration
./scripts/cognitive-tuning.js show
```

### Commands Reference

#### Show Configuration

```bash
# Display current configuration with system specs
./scripts/cognitive-tuning.js show
./scripts/cognitive-tuning.js status  # Alias for show
```

**Output Example:**
```
🎛️ Current Cognitive Performance Configuration:
============================================================

🖥️ System Specifications:
   CPU Cores: 32
   Total Memory: 30.5GB
   Available Memory: 17.3GB

⏱️ Processing Intervals:
   Consciousness Processing: 3500ms (3.5s)
   Stream Generation: 5250ms (5.3s)
   Memory Monitoring: 30000ms (30.0s)

💾 Memory Management:
   Cleanup Threshold: 75%
   Force GC Threshold: 85%
   Emergency Threshold: 95%

📊 Array Limits:
   Existential Questions: 500
   Thought History: 2000
   Stream Entries: 1000
   Current Thoughts: 200

🎯 Performance Mode: balanced
   CPU Scaling Factor: 1.00x
   Memory Scaling Factor: 1.00x
```

#### Performance Modes

```bash
# Set high-performance mode (50% faster, 50% more memory)
./scripts/cognitive-tuning.js mode high-performance

# Set balanced mode (optimal for system specs)
./scripts/cognitive-tuning.js mode balanced

# Set eco mode (50% slower, 50% less memory)
./scripts/cognitive-tuning.js mode eco
```

#### Custom Configuration

```bash
# Set specific values
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 5000
./scripts/cognitive-tuning.js set streamGenerationInterval 7500
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.7
./scripts/cognitive-tuning.js set maxThoughtHistory 1500

# Set boolean values
./scripts/cognitive-tuning.js set enableDebugLogging true
./scripts/cognitive-tuning.js set enablePerformanceMetrics false

# Set floating point values  
./scripts/cognitive-tuning.js set cpuLoadScalingFactor 1.2
./scripts/cognitive-tuning.js set memoryPressureScalingFactor 0.8
```

**Available Configuration Keys:**

| Key | Type | Description |
|-----|------|-------------|
| `consciousnessProcessingInterval` | number | Consciousness cycle interval (ms) |
| `streamGenerationInterval` | number | Stream generation interval (ms) |
| `memoryMonitoringInterval` | number | Memory monitoring interval (ms) |
| `healthCheckInterval` | number | Health check interval (ms) |
| `memoryCleanupThreshold` | float | Memory cleanup threshold (0-1) |
| `forceGCThreshold` | float | Force garbage collection threshold (0-1) |
| `emergencyCleanupThreshold` | float | Emergency cleanup threshold (0-1) |
| `maxExistentialQuestions` | number | Max existential questions |
| `maxThoughtHistory` | number | Max thought history entries |
| `maxStreamEntries` | number | Max stream of consciousness entries |
| `maxCurrentThoughts` | number | Max current thoughts |
| `cpuLoadScalingFactor` | float | CPU load scaling factor (0.5-2.0) |
| `memoryPressureScalingFactor` | float | Memory pressure scaling factor (0.5-2.0) |
| `enableDebugLogging` | boolean | Enable debug logging |
| `enablePerformanceMetrics` | boolean | Enable performance metrics |

#### Reset Configuration

```bash
# Reset to mathematically calculated optimal values
./scripts/cognitive-tuning.js reset
```

#### Environment Variables

```bash
# Generate environment variables for .env file
./scripts/cognitive-tuning.js env
```

**Output Example:**
```
🌍 Environment Variables (copy to your .env file):
============================================================
CONSCIOUSNESS_INTERVAL=3500
STREAM_INTERVAL=5250
MEMORY_CLEANUP_THRESHOLD=0.75
PERFORMANCE_MODE=balanced
DEBUG_TIMERS=false
```

#### Benchmark Analysis

```bash
# Show performance calculations and expected metrics
./scripts/cognitive-tuning.js benchmark
```

**Output Example:**
```
🏃 Running Performance Benchmark...
============================================================
Expected Performance:
   Consciousness cycles per minute: 17.1
   Stream entries per minute: 11.4
   Memory budget: 2345.2MB
   Estimated runtime before cleanup: 116.7 minutes
```

### Configuration File Location

The CLI tool stores configuration in:
```
~/.config/sentient-agi/cognitive-performance.json
```

You can manually edit this file or use the CLI commands. The file format is:

```json
{
  "consciousnessProcessingInterval": 3500,
  "streamGenerationInterval": 5250,
  "memoryMonitoringInterval": 30000,
  "healthCheckInterval": 120000,
  "memoryCleanupThreshold": 0.75,
  "forceGCThreshold": 0.85,
  "emergencyCleanupThreshold": 0.95,
  "maxExistentialQuestions": 500,
  "maxThoughtHistory": 2000,
  "maxStreamEntries": 1000,
  "maxCurrentThoughts": 200,
  "mode": "balanced",
  "cpuLoadScalingFactor": 1,
  "memoryPressureScalingFactor": 1,
  "enableDebugLogging": false,
  "enablePerformanceMetrics": true
}
```

## Database CLI Scripts

### Database Management Script

The `./scripts/db.sh` script provides comprehensive database management:

```bash
# Make executable (if needed)
chmod +x ./scripts/db.sh

# Available commands
./scripts/db.sh start     # Start PostgreSQL container
./scripts/db.sh stop      # Stop PostgreSQL container
./scripts/db.sh restart   # Restart PostgreSQL container
./scripts/db.sh status    # Show container status
./scripts/db.sh logs      # Show database logs
./scripts/db.sh clean     # Clean database and restart
```

### Database Reporting

```bash
# Generate comprehensive database report  
node generate-database-report.js

# Run acceptance tests
npm run build
node dist/test/memory/run-acceptance-tests.js
```

## Advanced Usage Examples

### Custom Performance Profiles

Create custom performance profiles for different scenarios:

```bash
# Development profile
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 2000
./scripts/cognitive-tuning.js set enableDebugLogging true
./scripts/cognitive-tuning.js set enablePerformanceMetrics true

# Production profile  
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 8000
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.6
./scripts/cognitive-tuning.js set enableDebugLogging false

# Battery-saver profile
./scripts/cognitive-tuning.js mode eco
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 15000
./scripts/cognitive-tuning.js set maxThoughtHistory 500
```

### Automated Performance Tuning

```bash
# Create a script for automatic tuning based on system load
#!/bin/bash

# Check system load
LOAD=$(uptime | awk '{print $NF}' | sed 's/,//')
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')

if (( $(echo "$LOAD > 2.0" | bc -l) )) || [ "$MEMORY_USAGE" -gt 80 ]; then
    echo "High system load detected, switching to eco mode"
    npm run tune:eco
elif (( $(echo "$LOAD < 0.5" | bc -l) )) && [ "$MEMORY_USAGE" -lt 40 ]; then
    echo "Low system load detected, switching to high-performance mode"
    npm run tune:high
else
    echo "Normal system load, using balanced mode"
    npm run tune:balanced
fi
```

### Integration with CI/CD

```bash
# In your CI/CD pipeline, ensure optimal configuration
npm run build
npm run db:start
npm run tune:reset  # Use optimal settings for CI environment
npm run test:all
npm run db:stop
```

## Environment Variables Reference

The system supports these environment variables:

### Core Configuration
```bash
MEMORY_STORE_TYPE=postgresql        # Enable PostgreSQL memory store
NODE_ENV=production                 # Set environment mode
DEBUG_TIMERS=true                   # Enable timer debugging
```

### PostgreSQL Configuration
```bash
POSTGRES_HOST=localhost             # Database host
POSTGRES_PORT=5432                  # Database port
POSTGRES_DB=map_think_do           # Database name
POSTGRES_USER=mtd_user             # Database user
POSTGRES_PASSWORD=p4ssw0rd         # Database password
POSTGRES_POOL_MAX=20               # Max connection pool size
POSTGRES_POOL_MIN=5                # Min connection pool size
POSTGRES_ENABLE_TIMESERIES=true    # Enable TimescaleDB
POSTGRES_SSL=false                 # Enable SSL connections
POSTGRES_DEBUG=false               # Enable PostgreSQL debug logging
```

### Performance Configuration
```bash
CONSCIOUSNESS_INTERVAL=5000         # Consciousness processing interval (ms)
STREAM_INTERVAL=7500               # Stream generation interval (ms)
MEMORY_CLEANUP_THRESHOLD=0.75      # Memory cleanup threshold (0-1)
PERFORMANCE_MODE=balanced          # Performance mode preset
```

## Troubleshooting Commands

### Performance Issues

```bash
# Check current performance
npm run tune:benchmark

# Show detailed configuration
npm run tune:show

# Reset to optimal
npm run tune:reset

# Switch to eco mode for stability
npm run tune:eco
```

### Database Issues

```bash
# Check database status
npm run db:status

# View logs
npm run db:logs

# Restart database
npm run db:restart

# Test database connection
MEMORY_STORE_TYPE=postgresql npm start
```

### Memory Issues

```bash
# Enable debug logging
./scripts/cognitive-tuning.js set enableDebugLogging true

# Lower memory thresholds
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.6
./scripts/cognitive-tuning.js set forceGCThreshold 0.7

# Reduce array limits
./scripts/cognitive-tuning.js set maxThoughtHistory 1000
./scripts/cognitive-tuning.js set maxStreamEntries 500
```

All CLI tools and scripts are designed to provide comprehensive control over the Sentient AGI Reasoning Server's performance and database features while maintaining ease of use and system stability.