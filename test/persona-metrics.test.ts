#!/usr/bin/env node

/**
 * @fileoverview Test suite for persona metrics and preference system
 */

import { PersonaConfigAPI } from '../src/cognitive/persona-config-api.js';
import { personaMetrics } from '../src/cognitive/persona-metrics.js';

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
};

function log(message: string, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

async function testPersonaMetrics() {
  log('\n🧪 Testing Persona Metrics and Preferences System', COLORS.BLUE);

  try {
    // Test 1: Get initial preferences
    log('\n📋 Test 1: Getting initial preferences...', COLORS.YELLOW);
    const initialPrefs = personaMetrics.getPreferences();
    log(`Initial bias: ${initialPrefs.persona_bias}`, COLORS.GREEN);
    log(`Initial threshold modifier: ${initialPrefs.persona_threshold_modifier}`, COLORS.GREEN);

    // Test 2: Update preferences
    log('\n📋 Test 2: Updating preferences to efficiency mode...', COLORS.YELLOW);
    const updateResult = PersonaConfigAPI.updatePreferences({
      persona_bias: 'efficiency',
      persona_threshold_modifier: 1.5,
      max_personas: 2,
    });

    if (updateResult.success) {
      log('✅ Preferences updated successfully', COLORS.GREEN);
      log(
        `New preferences: ${JSON.stringify(updateResult.currentPreferences, null, 2)}`,
        COLORS.GREEN
      );
    } else {
      log(`❌ Failed to update preferences: ${updateResult.message}`, COLORS.RED);
    }

    // Test 3: Get adjusted thresholds
    log('\n📋 Test 3: Getting adjusted thresholds...', COLORS.YELLOW);
    const thresholds = personaMetrics.getAdjustedThresholds();
    log(`Complexity threshold: ${thresholds.complexityThreshold.toFixed(1)}`, COLORS.GREEN);
    log(`Breakthrough threshold: ${thresholds.breakthroughThreshold.toFixed(2)}`, COLORS.GREEN);
    log(`Metacognitive threshold: ${thresholds.metacognitiveThreshold.toFixed(2)}`, COLORS.GREEN);

    // Test 4: Record sample metrics
    log('\n📋 Test 4: Recording sample metrics...', COLORS.YELLOW);

    // Simulate different scenarios
    const scenarios = [
      { complexity: 5, personas: 2, coherence: 0.8, responseTime: 1500, breakthrough: false },
      { complexity: 8, personas: 3, coherence: 0.7, responseTime: 2200, breakthrough: true },
      { complexity: 3, personas: 2, coherence: 0.9, responseTime: 800, breakthrough: false },
      { complexity: 9, personas: 3, coherence: 0.65, responseTime: 2800, breakthrough: true },
      { complexity: 6, personas: 2, coherence: 0.75, responseTime: 1200, breakthrough: false },
    ];

    for (const scenario of scenarios) {
      personaMetrics.recordMetric({
        synthesis_coherence: scenario.coherence,
        decision_confidence: scenario.coherence * 0.9,
        perspective_diversity: scenario.personas === 3 ? 0.8 : 0.4,
        response_time: scenario.responseTime,
        tokens_generated: scenario.responseTime * 0.5,
        persona_count_used: scenario.personas,
        complexity_score: scenario.complexity,
        domain: 'test',
        breakthrough_achievement: scenario.breakthrough,
        error_prevention: scenario.personas === 3,
      });
    }
    log(`✅ Recorded ${scenarios.length} sample metrics`, COLORS.GREEN);

    // Test 5: Get performance summary
    log('\n📋 Test 5: Getting performance summary...', COLORS.YELLOW);
    const perfSummary = PersonaConfigAPI.getPerformanceSummary();

    log('Performance Summary:', COLORS.GREEN);
    log(`  Total metrics: ${perfSummary.summary.totalMetrics}`, COLORS.GREEN);
    log(`  Avg response time: ${perfSummary.summary.avgResponseTime.toFixed(0)}ms`, COLORS.GREEN);
    log(`  Avg coherence: ${perfSummary.summary.avgCoherence.toFixed(2)}`, COLORS.GREEN);
    log(
      `  Breakthrough rate: ${(perfSummary.summary.breakthroughRate * 100).toFixed(0)}%`,
      COLORS.GREEN
    );
    log(
      `  Error prevention rate: ${(perfSummary.summary.errorPreventionRate * 100).toFixed(0)}%`,
      COLORS.GREEN
    );

    if (perfSummary.recommendations.length > 0) {
      log('\nRecommendations:', COLORS.YELLOW);
      perfSummary.recommendations.forEach((rec: string) => log(`  • ${rec}`, COLORS.YELLOW));
    }

    // Test 6: Apply preset
    log('\n📋 Test 6: Applying "thorough" preset...', COLORS.YELLOW);
    const presetResult = PersonaConfigAPI.applyPreset('thorough');

    if (presetResult.success) {
      log('✅ Preset applied successfully', COLORS.GREEN);
      log(`New bias: ${presetResult.currentPreferences.persona_bias}`, COLORS.GREEN);
      log(
        `New modifier: ${presetResult.currentPreferences.persona_threshold_modifier}`,
        COLORS.GREEN
      );
    } else {
      log(`❌ Failed to apply preset: ${presetResult.message}`, COLORS.RED);
    }

    // Test 7: Test validation
    log('\n📋 Test 7: Testing preference validation...', COLORS.YELLOW);

    const invalidUpdate = PersonaConfigAPI.updatePreferences({
      persona_threshold_modifier: 5.0, // Invalid: too high
    });

    if (!invalidUpdate.success) {
      log('✅ Correctly rejected invalid threshold modifier', COLORS.GREEN);
    } else {
      log('❌ Failed to reject invalid threshold modifier', COLORS.RED);
    }

    const invalidMinMax = PersonaConfigAPI.updatePreferences({
      min_personas: 3,
      max_personas: 2, // Invalid: min > max
    });

    if (!invalidMinMax.success) {
      log('✅ Correctly rejected invalid min/max personas', COLORS.GREEN);
    } else {
      log('❌ Failed to reject invalid min/max personas', COLORS.RED);
    }

    // Test 8: Export metrics
    log('\n📋 Test 8: Exporting metrics...', COLORS.YELLOW);
    const exported = PersonaConfigAPI.exportMetrics();
    log(`✅ Exported ${exported.metrics.length} metrics at ${exported.exportTime}`, COLORS.GREEN);

    // Test 9: Get all presets
    log('\n📋 Test 9: Getting available presets...', COLORS.YELLOW);
    const presets = PersonaConfigAPI.getPresets();
    log(`Available presets: ${Object.keys(presets).join(', ')}`, COLORS.GREEN);

    // Test 10: Clear metrics
    log('\n📋 Test 10: Clearing metrics...', COLORS.YELLOW);
    const clearResult = PersonaConfigAPI.resetMetrics();
    if (clearResult.success) {
      log('✅ Metrics cleared successfully', COLORS.GREEN);
    } else {
      log(`❌ Failed to clear metrics: ${clearResult.message}`, COLORS.RED);
    }

    log('\n✨ All tests completed successfully!', COLORS.GREEN);
  } catch (error) {
    log(`\n❌ Test failed with error: ${error}`, COLORS.RED);
    process.exit(1);
  }
}

// Run tests
testPersonaMetrics().catch(error => {
  log(`Fatal error: ${error}`, COLORS.RED);
  process.exit(1);
});
