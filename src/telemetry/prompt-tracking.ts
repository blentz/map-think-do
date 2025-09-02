import { context, Context } from '@opentelemetry/api';

/**
 * Prompt Template Tracking for Phoenix Observability
 *
 * This module provides context-based prompt template tracking
 * without using Math.random() or hardcoded fake values.
 */

export interface PromptTemplate {
  template: string;
  version: string;
  variables: Record<string, any>;
}

export interface PromptVariables {
  [key: string]: string | number | boolean | null;
}

const PROMPT_TEMPLATE_KEY = Symbol('prompt_template');
const PROMPT_VARIABLES_KEY = Symbol('prompt_variables');

/**
 * Set prompt template in the current context
 */
export function setPromptTemplate(ctx: Context, template: PromptTemplate): Context {
  return ctx.setValue(PROMPT_TEMPLATE_KEY, template);
}

/**
 * Get prompt template from the current context
 */
export function getPromptTemplate(ctx: Context): PromptTemplate | undefined {
  return ctx.getValue(PROMPT_TEMPLATE_KEY) as PromptTemplate | undefined;
}

/**
 * Set prompt variables in the current context
 */
export function setPromptVariables(ctx: Context, variables: PromptVariables): Context {
  return ctx.setValue(PROMPT_VARIABLES_KEY, variables);
}

/**
 * Get prompt variables from the current context
 */
export function getPromptVariables(ctx: Context): PromptVariables | undefined {
  return ctx.getValue(PROMPT_VARIABLES_KEY) as PromptVariables | undefined;
}

/**
 * Execute a function within a prompt template context
 */
export function withPromptTemplate<T>(template: PromptTemplate, fn: () => T): T {
  const activeContext = context.active();
  const newContext = setPromptTemplate(activeContext, template);
  return context.with(newContext, fn);
}

/**
 * Execute a function within a prompt variables context
 */
export function withPromptVariables<T>(variables: PromptVariables, fn: () => T): T {
  const activeContext = context.active();
  const newContext = setPromptVariables(activeContext, variables);
  return context.with(newContext, fn);
}

/**
 * Execute a function within both prompt template and variables context
 */
export function withPromptContext<T>(
  template: PromptTemplate,
  variables: PromptVariables,
  fn: () => T
): T {
  const activeContext = context.active();
  let newContext = setPromptTemplate(activeContext, template);
  newContext = setPromptVariables(newContext, variables);
  return context.with(newContext, fn);
}

/**
 * Create a prompt template with proper version tracking
 */
export function createPromptTemplate(
  template: string,
  variables: Record<string, any> = {},
  version: string = '1.0.0'
): PromptTemplate {
  return {
    template,
    version,
    variables,
  };
}

/**
 * Validate prompt template structure
 */
export function validatePromptTemplate(template: PromptTemplate): boolean {
  if (!template.template || typeof template.template !== 'string') {
    return false;
  }
  if (!template.version || typeof template.version !== 'string') {
    return false;
  }
  if (!template.variables || typeof template.variables !== 'object') {
    return false;
  }
  return true;
}

/**
 * Extract template variables from a template string
 */
export function extractTemplateVariables(template: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Substitute variables in a template string
 */
export function substituteTemplateVariables(template: string, variables: PromptVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
    const value = variables[variableName];
    return value !== undefined ? String(value) : match;
  });
}
