/**
 * @fileoverview Persona Configuration API
 * 
 * Provides an API for updating persona preferences and viewing performance metrics
 */

import { PersonaPreferences, personaMetrics } from './persona-metrics.js';

export class PersonaConfigAPI {
  /**
   * Update persona preferences
   */
  static updatePreferences(preferences: Partial<PersonaPreferences>): {
    success: boolean;
    message: string;
    currentPreferences: PersonaPreferences;
  } {
    try {
      // Validate preferences
      if (preferences.persona_threshold_modifier !== undefined) {
        if (preferences.persona_threshold_modifier < 0.5 || preferences.persona_threshold_modifier > 2.0) {
          return {
            success: false,
            message: 'persona_threshold_modifier must be between 0.5 and 2.0',
            currentPreferences: personaMetrics.getPreferences()
          };
        }
      }
      
      if (preferences.min_personas !== undefined && preferences.max_personas !== undefined) {
        if (preferences.min_personas > preferences.max_personas) {
          return {
            success: false,
            message: 'min_personas cannot be greater than max_personas',
            currentPreferences: personaMetrics.getPreferences()
          };
        }
      }
      
      if (preferences.diversity_weight !== undefined) {
        if (preferences.diversity_weight < 0 || preferences.diversity_weight > 1) {
          return {
            success: false,
            message: 'diversity_weight must be between 0 and 1',
            currentPreferences: personaMetrics.getPreferences()
          };
        }
      }
      
      // Update preferences
      personaMetrics.updatePreferences(preferences);
      
      return {
        success: true,
        message: 'Preferences updated successfully',
        currentPreferences: personaMetrics.getPreferences()
      };
    } catch (error) {
      return {
        success: false,
        message: `Error updating preferences: ${error}`,
        currentPreferences: personaMetrics.getPreferences()
      };
    }
  }
  
  /**
   * Get current performance summary
   */
  static getPerformanceSummary(): {
    summary: ReturnType<typeof personaMetrics.getPerformanceSummary>;
    preferences: PersonaPreferences;
    recommendations: string[];
  } {
    const summary = personaMetrics.getPerformanceSummary();
    const preferences = personaMetrics.getPreferences();
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (summary.avgResponseTime > 2500 && preferences.persona_bias !== 'efficiency') {
      recommendations.push('Consider "efficiency" bias - response times are above 2.5s');
    }
    
    if (summary.avgCoherence < 0.5 && preferences.persona_bias !== 'thorough') {
      recommendations.push('Consider "thorough" bias - coherence scores are below 0.5');
    }
    
    if (summary.breakthroughRate > 0.3 && preferences.persona_bias === 'efficiency') {
      recommendations.push('3-persona mode is achieving high breakthrough rate - consider "balanced" or "thorough" bias');
    }
    
    if (summary.errorPreventionRate > 0.4 && preferences.preferred_personas?.indexOf('skeptic') === -1) {
      recommendations.push('Skeptic persona is preventing errors effectively - consider adding to preferred_personas');
    }
    
    // Check persona count distribution
    const distribution = Object.entries(summary.personaCountDistribution).map(([count, usage]) => [parseInt(count), usage]);
    const mostUsed = distribution.sort((a, b) => b[1] - a[1])[0];
    if (mostUsed && mostUsed[0] !== 2) {
      recommendations.push(`System is naturally gravitating toward ${mostUsed[0]} personas - consider adjusting defaults`);
    }
    
    return {
      summary,
      preferences,
      recommendations
    };
  }
  
  /**
   * Reset metrics
   */
  static resetMetrics(): { success: boolean; message: string } {
    try {
      personaMetrics.clearMetrics();
      return { success: true, message: 'Metrics cleared successfully' };
    } catch (error) {
      return { success: false, message: `Error clearing metrics: ${error}` };
    }
  }
  
  /**
   * Export metrics for analysis
   */
  static exportMetrics(): {
    metrics: ReturnType<typeof personaMetrics.exportMetrics>;
    exportTime: string;
  } {
    return {
      metrics: personaMetrics.exportMetrics(),
      exportTime: new Date().toISOString()
    };
  }
  
  /**
   * Get preset configurations
   */
  static getPresets(): Record<string, PersonaPreferences> {
    return {
      efficiency: {
        persona_bias: 'efficiency',
        persona_threshold_modifier: 1.3,
        max_personas: 2,
        diversity_weight: 0.3,
        synthesis_strategy: 'weighted'
      },
      balanced: {
        persona_bias: 'balanced',
        persona_threshold_modifier: 1.0,
        max_personas: 3,
        diversity_weight: 0.5,
        synthesis_strategy: 'consensus'
      },
      thorough: {
        persona_bias: 'thorough',
        persona_threshold_modifier: 0.7,
        min_personas: 2,
        max_personas: 3,
        diversity_weight: 0.7,
        synthesis_strategy: 'dialectic'
      },
      creative: {
        persona_bias: 'thorough',
        persona_threshold_modifier: 0.8,
        preferred_personas: ['creative', 'philosopher', 'strategist'],
        diversity_weight: 0.8,
        synthesis_strategy: 'dialectic'
      },
      analytical: {
        persona_bias: 'balanced',
        persona_threshold_modifier: 1.0,
        preferred_personas: ['analyst', 'skeptic', 'engineer'],
        diversity_weight: 0.4,
        synthesis_strategy: 'weighted'
      }
    };
  }
  
  /**
   * Apply a preset configuration
   */
  static applyPreset(presetName: string): {
    success: boolean;
    message: string;
    currentPreferences: PersonaPreferences;
  } {
    const presets = PersonaConfigAPI.getPresets();
    const preset = presets[presetName];
    
    if (!preset) {
      return {
        success: false,
        message: `Unknown preset: ${presetName}. Available: ${Object.keys(presets).join(', ')}`,
        currentPreferences: personaMetrics.getPreferences()
      };
    }
    
    return PersonaConfigAPI.updatePreferences(preset);
  }
}