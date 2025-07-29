# Cognitive Performance Tuning Guide

The Sentient AGI Reasoning Server includes an advanced performance configuration system that automatically calculates optimal timing intervals based on your system specifications and provides user-configurable performance tuning.

## Quick Start

### View Current Configuration

```bash
# Show current performance settings
npm run tune

# Or use the CLI directly
./scripts/cognitive-tuning.js show
```

### Set Performance Mode

```bash
# High-performance mode (faster intervals, more memory usage)
npm run tune:high

# Balanced mode (optimal for most systems)
npm run tune:balanced

# Eco mode (slower intervals, less memory usage)
npm run tune:eco
```

### Generate Environment Variables

```bash
# Export settings for .env file
npm run tune:env
```

## Mathematical Approach

The system calculates optimal configuration values based on your system specifications using mathematical scaling formulas.

### System Analysis

The performance manager automatically detects:
- **CPU Cores**: Available processing units
- **Total Memory**: System RAM capacity
- **Available Memory**: Currently free memory

### Scaling Calculations

**CPU Scaling Formula:**
```
cpuScaling = Math.max(0.5, Math.min(2.0, 8 / cpuCores))
```
- 8 cores or more: Scale factor ≤ 1.0 (faster processing)
- Fewer than 8 cores: Scale factor > 1.0 (slower processing)
- Clamped between 0.5x and 2.0x for stability

**Memory Scaling Formula:**
```
memoryScaling = Math.max(0.7, Math.min(1.5, 8 / totalMemoryGB))
```
- 8GB or more: Scale factor ≤ 1.0 (more frequent processing)
- Less than 8GB: Scale factor > 1.0 (less frequent processing)
- Clamped between 0.7x and 1.5x for stability

**Final Interval Calculation:**
```
consciousnessInterval = 10000ms * cpuScaling * memoryScaling
streamInterval = 15000ms * cpuScaling * memoryScaling
```

### Memory Budget Calculation

**Cognitive Memory Allocation:**
```
memoryBudget = (totalMemoryGB * 1024MB) * 0.075  // 7.5% of total memory
avgObjectSize = 1.5KB  // Average size per cognitive object
maxObjects = memoryBudget / avgObjectSize
```

**Array Distribution:**
- Existential Questions: 10% of maxObjects (max 500)
- Thought History: 40% of maxObjects (max 2000)
- Stream Entries: 30% of maxObjects (max 1000)
- Current Thoughts: 20% of maxObjects (max 200)

## Example Calculations

### High-End System (32 cores, 30.5GB RAM)

```
CPU Scaling: max(0.5, min(2.0, 8/32)) = 0.5x
Memory Scaling: max(0.7, min(1.5, 8/30.5)) = 0.7x

Consciousness Interval: 10000ms * 0.5 * 0.7 = 3500ms (3.5s)
Stream Interval: 15000ms * 0.5 * 0.7 = 5250ms (5.3s)

Memory Budget: 30.5GB * 0.075 = 2.3GB
Max Objects: 2345MB / 1.5KB = 1,609,387 objects

Array Limits:
- Existential Questions: 500 (10%)
- Thought History: 2000 (40%) 
- Stream Entries: 1000 (30%)
- Current Thoughts: 200 (20%)
```

### Mid-Range System (8 cores, 16GB RAM)

```
CPU Scaling: max(0.5, min(2.0, 8/8)) = 1.0x
Memory Scaling: max(0.7, min(1.5, 8/16)) = 0.7x

Consciousness Interval: 10000ms * 1.0 * 0.7 = 7000ms (7s)
Stream Interval: 15000ms * 1.0 * 0.7 = 10500ms (10.5s)

Memory Budget: 16GB * 0.075 = 1.2GB
```

### Low-End System (4 cores, 8GB RAM)

```
CPU Scaling: max(0.5, min(2.0, 8/4)) = 2.0x
Memory Scaling: max(0.7, min(1.5, 8/8)) = 1.0x

Consciousness Interval: 10000ms * 2.0 * 1.0 = 20000ms (20s)
Stream Interval: 15000ms * 2.0 * 1.0 = 30000ms (30s)

Memory Budget: 8GB * 0.075 = 600MB
```

## Performance Modes

### High-Performance Mode
- **Intervals**: 50% faster than calculated optimal
- **Memory**: 50% larger array limits
- **Cleanup Threshold**: 80% (aggressive)
- **Use Case**: Maximum AGI capability, high-end systems

### Balanced Mode (Default)
- **Intervals**: Mathematically calculated optimal values
- **Memory**: Standard array limits based on system specs
- **Cleanup Threshold**: 75% (standard)
- **Use Case**: Best balance of performance and stability

### Eco Mode
- **Intervals**: 50% slower than calculated optimal
- **Memory**: 50% smaller array limits
- **Cleanup Threshold**: 60% (conservative)
- **Use Case**: Battery-powered systems, resource constraints

## CLI Tool Usage

### Available Commands

```bash
# Show current configuration and system specs
./scripts/cognitive-tuning.js show

# Reset to optimal values for your system
./scripts/cognitive-tuning.js reset

# Set performance mode
./scripts/cognitive-tuning.js mode [high-performance|balanced|eco]

# Set specific configuration value
./scripts/cognitive-tuning.js set <key> <value>

# Generate environment variables
./scripts/cognitive-tuning.js env

# Show performance benchmark calculations
./scripts/cognitive-tuning.js benchmark

# Show help
./scripts/cognitive-tuning.js help
```

### NPM Script Shortcuts

```bash
npm run tune              # Show current config
npm run tune:show         # Show current config
npm run tune:reset        # Reset to optimal
npm run tune:high         # High-performance mode
npm run tune:balanced     # Balanced mode
npm run tune:eco          # Eco mode
npm run tune:env          # Generate environment variables
npm run tune:benchmark    # Show benchmark calculations
npm run tune:help         # Show help
```

### Custom Configuration Examples

```bash
# Adjust consciousness processing interval
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 5000

# Change memory cleanup threshold
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.7

# Increase thought history limit
./scripts/cognitive-tuning.js set maxThoughtHistory 1000

# Enable debug logging
./scripts/cognitive-tuning.js set enableDebugLogging true
```

## Runtime Adaptive Scaling

The system includes runtime adaptive scaling that automatically adjusts based on current system load:

### Memory Pressure Adaptation
- **High pressure (>80% heap usage)**: Increase scaling factor (slower processing)
- **Low pressure (<40% heap usage)**: Decrease scaling factor (faster processing)
- **Scaling factor range**: 0.5x to 2.0x

### Automatic Cleanup Triggers
- **75% memory usage**: Standard cleanup
- **85% memory usage**: Force garbage collection
- **95% memory usage**: Emergency cleanup (aggressive array trimming)

## Configuration File

The system stores configuration in:
```
~/.config/sentient-agi/cognitive-performance.json
```

### Example Configuration File

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
  "cpuLoadScalingFactor": 1.0,
  "memoryPressureScalingFactor": 1.0,
  "enableDebugLogging": false,
  "enablePerformanceMetrics": true
}
```

## Environment Variable Integration

The system supports environment variable overrides:

```bash
# Individual settings
export CONSCIOUSNESS_INTERVAL=5000
export STREAM_INTERVAL=7500
export MEMORY_CLEANUP_THRESHOLD=0.7

# Performance mode (overrides individual settings)
export PERFORMANCE_MODE=high-performance

# Debug options
export DEBUG_TIMERS=true
```

## Monitoring & Debugging

### Performance Metrics

The system logs real-time performance metrics:
- Consciousness cycles per minute
- Stream entries per minute
- Memory usage and cleanup events
- Timer coordination statistics

### Debug Mode

Enable debug logging to see detailed performance information:

```bash
# Via environment variable
export DEBUG_TIMERS=true

# Via CLI
./scripts/cognitive-tuning.js set enableDebugLogging true
```

### Benchmark Analysis

Use the benchmark command to analyze expected performance:

```bash
npm run tune:benchmark
```

Output includes:
- Expected consciousness cycles per minute
- Expected stream entries per minute
- Memory budget allocation
- Estimated runtime before cleanup

## Troubleshooting

### Performance Issues

**Symptoms**: High CPU usage, slow responses
```bash
# Check if intervals are too aggressive
npm run tune:benchmark

# Switch to eco mode temporarily
npm run tune:eco

# Or increase intervals manually
./scripts/cognitive-tuning.js set consciousnessProcessingInterval 10000
```

**Symptoms**: Memory leaks, OOM errors
```bash
# Check memory thresholds
npm run tune:show

# Lower cleanup threshold
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.6

# Reduce array limits
./scripts/cognitive-tuning.js set maxThoughtHistory 1000
```

### Configuration Reset

```bash
# Reset to system-optimal defaults
npm run tune:reset

# Or delete configuration file
rm ~/.config/sentient-agi/cognitive-performance.json
```

## Production Recommendations

### High-Traffic Systems
```bash
# Use eco mode for stability
npm run tune:eco

# Lower memory thresholds
./scripts/cognitive-tuning.js set memoryCleanupThreshold 0.6
./scripts/cognitive-tuning.js set forceGCThreshold 0.7
```

### Development Systems
```bash
# Enable debug logging
./scripts/cognitive-tuning.js set enableDebugLogging true

# Use balanced mode
npm run tune:balanced
```

### Resource-Constrained Systems
```bash
# Use eco mode
npm run tune:eco

# Reduce array limits
./scripts/cognitive-tuning.js set maxThoughtHistory 500
./scripts/cognitive-tuning.js set maxStreamEntries 250
```

The performance tuning system ensures optimal AGI consciousness simulation while maintaining system stability and user configurability across diverse hardware configurations.