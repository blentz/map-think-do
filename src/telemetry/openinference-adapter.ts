import { Span } from '@opentelemetry/api';

export interface LLMPrompt {
  role: string;
  content: string;
  tokens: number;
}

export interface LLMCompletion {
  role: string;
  content: string;
  tokens: number;
  finish_reason: string;
}

export class OpenInferenceAdapter {
  private costCalculator: CostCalculator;

  constructor() {
    this.costCalculator = new CostCalculator();
  }

  /**
   * Applies OpenInference semantic conventions to a span
   */
  applyConventions(
    span: Span,
    config: {
      spanKind: 'REQUEST' | 'PROCESS' | 'TOOL' | 'STORAGE';
      operation?: string;
      model?: string;
      prompts?: LLMPrompt[];
      completions?: LLMCompletion[];
      metadata?: Record<string, any>;
    }
  ): void {
    // Required attributes
    span.setAttribute('openinference.span.kind', config.spanKind);
    span.setAttribute('service.name', 'mcp-server');
    span.setAttribute('service.version', process.env.npm_package_version || '1.0.0');
    span.setAttribute('service.instance.id', `mcp-${process.pid}-${Date.now()}`);

    // LLM attributes
    if (config.model) {
      span.setAttribute('llm.vendor', 'anthropic');
      span.setAttribute('llm.model', config.model);
      span.setAttribute('llm.model_version', this.getModelVersion(config.model));
    }

    // Prompt tracking
    if (config.prompts) {
      const promptTokens = config.prompts.reduce((sum, p) => sum + p.tokens, 0);
      span.setAttribute('llm.prompts', JSON.stringify(config.prompts));
      span.setAttribute('llm.token_count.prompt', promptTokens);
    }

    // Completion tracking
    if (config.completions) {
      const completionTokens = config.completions.reduce((sum, c) => sum + c.tokens, 0);
      span.setAttribute('llm.completions', JSON.stringify(config.completions));
      span.setAttribute('llm.token_count.completion', completionTokens);

      // Calculate total tokens and cost
      const promptTokens = config.prompts?.reduce((sum, p) => sum + p.tokens, 0) || 0;
      const totalTokens = promptTokens + completionTokens;

      span.setAttribute('llm.token_count.total', totalTokens);
      span.setAttribute(
        'llm.cost.total',
        this.costCalculator.calculate(
          promptTokens,
          completionTokens,
          config.model || 'claude-3-sonnet'
        )
      );
    }

    // Performance metrics
    span.setAttribute('performance.latency_ms', 0); // Will be updated when span ends
    span.setAttribute('performance.cpu_time_ms', process.cpuUsage().user / 1000);
    span.setAttribute('performance.memory_mb', process.memoryUsage().heapUsed / 1048576);

    // Additional metadata
    if (config.metadata) {
      Object.entries(config.metadata).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  private getModelVersion(model: string): string {
    const versions: Record<string, string> = {
      'claude-3-opus': '20240229',
      'claude-3-sonnet': '20240229',
      'claude-3-haiku': '20240307',
      'claude-2.1': '20231106',
      'claude-2': '20230711',
    };
    return versions[model] || 'unknown';
  }
}

export class TokenEstimator {
  estimate(text: string): number {
    // Claude approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

class CostCalculator {
  private readonly pricing = {
    'claude-3-opus': { prompt: 15.0, completion: 75.0 },
    'claude-3-sonnet': { prompt: 3.0, completion: 15.0 },
    'claude-3-haiku': { prompt: 0.25, completion: 1.25 },
  };

  calculate(promptTokens: number, completionTokens: number, model: string): number {
    const modelPricing =
      this.pricing[model as keyof typeof this.pricing] || this.pricing['claude-3-sonnet'];
    const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;
    return Number((promptCost + completionCost).toFixed(6));
  }
}
