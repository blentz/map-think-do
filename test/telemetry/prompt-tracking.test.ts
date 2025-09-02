import { describe, it, expect } from '@jest/globals';
import { context } from '@opentelemetry/api';
import {
  PromptTemplate,
  PromptVariables,
  setPromptTemplate,
  getPromptTemplate,
  setPromptVariables,
  getPromptVariables,
  withPromptTemplate,
  withPromptVariables,
  withPromptContext,
  createPromptTemplate,
  validatePromptTemplate,
  extractTemplateVariables,
  substituteTemplateVariables,
} from '../../src/telemetry/prompt-tracking.js';

describe('Prompt Tracking', () => {
  describe('Context Management', () => {
    it('should set and get prompt template in context', () => {
      const template: PromptTemplate = {
        template: 'Hello {{name}}!',
        version: '1.0.0',
        variables: { name: 'World' },
      };

      const activeContext = context.active();
      const newContext = setPromptTemplate(activeContext, template);
      const retrievedTemplate = getPromptTemplate(newContext);

      expect(retrievedTemplate).toEqual(template);
    });

    it('should set and get prompt variables in context', () => {
      const variables: PromptVariables = { name: 'Test', count: 42 };

      const activeContext = context.active();
      const newContext = setPromptVariables(activeContext, variables);
      const retrievedVariables = getPromptVariables(newContext);

      expect(retrievedVariables).toEqual(variables);
    });

    it('should execute function within prompt template context', () => {
      const template: PromptTemplate = {
        template: 'Test template',
        version: '1.0.0',
        variables: {},
      };

      let capturedTemplate: PromptTemplate | undefined;

      withPromptTemplate(template, () => {
        capturedTemplate = getPromptTemplate(context.active());
      });

      expect(capturedTemplate).toEqual(template);
    });

    it('should execute function within prompt variables context', () => {
      const variables: PromptVariables = { test: 'value' };

      let capturedVariables: PromptVariables | undefined;

      withPromptVariables(variables, () => {
        capturedVariables = getPromptVariables(context.active());
      });

      expect(capturedVariables).toEqual(variables);
    });

    it('should execute function within both template and variables context', () => {
      const template: PromptTemplate = {
        template: 'Hello {{name}}!',
        version: '1.0.0',
        variables: { name: 'Test' },
      };
      const variables: PromptVariables = { name: 'World', extra: 'value' };

      let capturedTemplate: PromptTemplate | undefined;
      let capturedVariables: PromptVariables | undefined;

      withPromptContext(template, variables, () => {
        capturedTemplate = getPromptTemplate(context.active());
        capturedVariables = getPromptVariables(context.active());
      });

      expect(capturedTemplate).toEqual(template);
      expect(capturedVariables).toEqual(variables);
    });
  });

  describe('Template Creation and Validation', () => {
    it('should create a prompt template with defaults', () => {
      const template = createPromptTemplate('Hello {{name}}!');

      expect(template).toEqual({
        template: 'Hello {{name}}!',
        version: '1.0.0',
        variables: {},
      });
    });

    it('should create a prompt template with custom version and variables', () => {
      const variables = { name: 'World', greeting: 'Hello' };
      const template = createPromptTemplate('{{greeting}} {{name}}!', variables, '2.0.0');

      expect(template).toEqual({
        template: '{{greeting}} {{name}}!',
        version: '2.0.0',
        variables,
      });
    });

    it('should validate a correct prompt template', () => {
      const template: PromptTemplate = {
        template: 'Hello {{name}}!',
        version: '1.0.0',
        variables: { name: 'World' },
      };

      expect(validatePromptTemplate(template)).toBe(true);
    });

    it('should reject invalid prompt templates', () => {
      expect(validatePromptTemplate({} as PromptTemplate)).toBe(false);
      expect(
        validatePromptTemplate({
          template: '',
          version: '1.0.0',
          variables: {},
        })
      ).toBe(false);
      expect(
        validatePromptTemplate({
          template: 'Hello',
          version: '',
          variables: {},
        })
      ).toBe(false);
      expect(
        validatePromptTemplate({
          template: 'Hello',
          version: '1.0.0',
          variables: null as any,
        })
      ).toBe(false);
    });
  });

  describe('Template Variable Processing', () => {
    it('should extract variables from template', () => {
      const template = 'Hello {{name}}, you have {{count}} messages from {{sender}}!';
      const variables = extractTemplateVariables(template);

      expect(variables).toEqual(['name', 'count', 'sender']);
    });

    it('should handle templates with no variables', () => {
      const template = 'Hello World!';
      const variables = extractTemplateVariables(template);

      expect(variables).toEqual([]);
    });

    it('should handle templates with duplicate variables', () => {
      const template = 'Hello {{name}}, {{name}} is your name!';
      const variables = extractTemplateVariables(template);

      expect(variables).toEqual(['name']);
    });

    it('should substitute variables in template', () => {
      const template = 'Hello {{name}}, you have {{count}} messages!';
      const variables: PromptVariables = { name: 'John', count: 5 };
      const result = substituteTemplateVariables(template, variables);

      expect(result).toBe('Hello John, you have 5 messages!');
    });

    it('should handle missing variables in substitution', () => {
      const template = 'Hello {{name}}, you have {{count}} messages!';
      const variables: PromptVariables = { name: 'John' };
      const result = substituteTemplateVariables(template, variables);

      expect(result).toBe('Hello John, you have {{count}} messages!');
    });

    it('should handle templates with no variable markers', () => {
      const template = 'Hello World!';
      const variables: PromptVariables = { name: 'John' };
      const result = substituteTemplateVariables(template, variables);

      expect(result).toBe('Hello World!');
    });
  });
});
