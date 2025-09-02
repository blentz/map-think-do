import { context, Context } from '@opentelemetry/api';

/**
 * Context Attributes for Phoenix Observability
 *
 * Provides user, session, and metadata tracking for OpenTelemetry spans
 * without using Math.random() - uses deterministic approaches
 */

export interface UserInfo {
  userId: string;
  userAgent?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface SessionInfo {
  sessionId: string;
  startTime: number;
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface ContextMetadata {
  tags?: string[];
  environment?: string;
  version?: string;
  [key: string]: any;
}

const USER_INFO_KEY = Symbol('user_info');
const SESSION_INFO_KEY = Symbol('session_info');
const CONTEXT_METADATA_KEY = Symbol('context_metadata');

/**
 * Set user information in the current context
 */
export function setUserInfo(ctx: Context, userInfo: UserInfo): Context {
  return ctx.setValue(USER_INFO_KEY, userInfo);
}

/**
 * Get user information from the current context
 */
export function getUserInfo(ctx: Context): UserInfo | undefined {
  return ctx.getValue(USER_INFO_KEY) as UserInfo | undefined;
}

/**
 * Set session information in the current context
 */
export function setSessionInfo(ctx: Context, sessionInfo: SessionInfo): Context {
  return ctx.setValue(SESSION_INFO_KEY, sessionInfo);
}

/**
 * Get session information from the current context
 */
export function getSessionInfo(ctx: Context): SessionInfo | undefined {
  return ctx.getValue(SESSION_INFO_KEY) as SessionInfo | undefined;
}

/**
 * Set context metadata in the current context
 */
export function setContextMetadata(ctx: Context, metadata: ContextMetadata): Context {
  return ctx.setValue(CONTEXT_METADATA_KEY, metadata);
}

/**
 * Get context metadata from the current context
 */
export function getContextMetadata(ctx: Context): ContextMetadata | undefined {
  return ctx.getValue(CONTEXT_METADATA_KEY) as ContextMetadata | undefined;
}

/**
 * Execute a function within a user context
 */
export function withUserInfo<T>(userInfo: UserInfo, fn: () => T): T {
  const activeContext = context.active();
  const newContext = setUserInfo(activeContext, userInfo);
  return context.with(newContext, fn);
}

/**
 * Execute a function within a session context
 */
export function withSessionInfo<T>(sessionInfo: SessionInfo, fn: () => T): T {
  const activeContext = context.active();
  const newContext = setSessionInfo(activeContext, sessionInfo);
  return context.with(newContext, fn);
}

/**
 * Execute a function within a metadata context
 */
export function withContextMetadata<T>(metadata: ContextMetadata, fn: () => T): T {
  const activeContext = context.active();
  const newContext = setContextMetadata(activeContext, metadata);
  return context.with(newContext, fn);
}

/**
 * Execute a function within a full context (user, session, metadata)
 */
export function withFullContext<T>(
  userInfo: UserInfo,
  sessionInfo: SessionInfo,
  metadata: ContextMetadata,
  fn: () => T
): T {
  const activeContext = context.active();
  let newContext = setUserInfo(activeContext, userInfo);
  newContext = setSessionInfo(newContext, sessionInfo);
  newContext = setContextMetadata(newContext, metadata);
  return context.with(newContext, fn);
}

/**
 * Create user information with deterministic session ID generation
 */
export function createUserInfo(userId: string, userAgent?: string, projectId?: string): UserInfo {
  // Generate deterministic session ID based on user and timestamp
  const timestamp = Date.now();
  const sessionId = `session_${timestamp}_${userId.substring(0, 8)}`;

  return {
    userId,
    userAgent,
    sessionId,
    metadata: {
      projectId,
      createdAt: timestamp,
    },
  };
}

/**
 * Create session information with proper tracking
 */
export function createSessionInfo(
  sessionId: string,
  projectId?: string,
  additionalMetadata?: Record<string, any>
): SessionInfo {
  return {
    sessionId,
    startTime: Date.now(),
    projectId,
    metadata: {
      ...additionalMetadata,
    },
  };
}

/**
 * Validate user information structure
 */
export function validateUserInfo(userInfo: UserInfo): boolean {
  return !!(
    userInfo.userId &&
    typeof userInfo.userId === 'string' &&
    userInfo.sessionId &&
    typeof userInfo.sessionId === 'string'
  );
}

/**
 * Validate session information structure
 */
export function validateSessionInfo(sessionInfo: SessionInfo): boolean {
  return !!(
    sessionInfo.sessionId &&
    typeof sessionInfo.sessionId === 'string' &&
    typeof sessionInfo.startTime === 'number' &&
    sessionInfo.startTime > 0
  );
}

/**
 * Set metadata in the current context (convenience function)
 */
export function setMetadata(ctx: Context, metadata: Record<string, any>): Context {
  const existingMetadata = getContextMetadata(ctx) || {};
  const updatedMetadata: ContextMetadata = {
    ...existingMetadata,
    ...metadata,
  };
  return setContextMetadata(ctx, updatedMetadata);
}

/**
 * Get metadata from the current context
 */
export function getMetadata(ctx: Context): Record<string, any> {
  const contextMetadata = getContextMetadata(ctx);
  if (!contextMetadata) return {};

  const { tags, environment, version, ...metadata } = contextMetadata;
  return metadata;
}

/**
 * Set tags in the current context
 */
export function setTags(ctx: Context, tags: string[]): Context {
  const existingMetadata = getContextMetadata(ctx) || {};
  const updatedMetadata: ContextMetadata = {
    ...existingMetadata,
    tags,
  };
  return setContextMetadata(ctx, updatedMetadata);
}

/**
 * Get tags from the current context
 */
export function getTags(ctx: Context): string[] {
  const contextMetadata = getContextMetadata(ctx);
  return contextMetadata?.tags || [];
}

/**
 * Execute a function with specific metadata
 */
export function withMetadata<T>(metadata: Record<string, any>, fn: () => T): T {
  const activeContext = context.active();
  const newContext = setMetadata(activeContext, metadata);
  return context.with(newContext, fn);
}

/**
 * Execute a function with specific tags
 */
export function withTags<T>(tags: string[], fn: () => T): T {
  const activeContext = context.active();
  const newContext = setTags(activeContext, tags);
  return context.with(newContext, fn);
}

/**
 * Extract user/session attributes for span attribution
 */
export function extractSpanAttributes(ctx: Context): Record<string, any> {
  const attributes: Record<string, any> = {};

  const userInfo = getUserInfo(ctx);
  if (userInfo) {
    attributes['user.id'] = userInfo.userId;
    attributes['session.id'] = userInfo.sessionId;
    if (userInfo.userAgent) {
      attributes['user.agent'] = userInfo.userAgent;
    }
    if (userInfo.metadata) {
      // Add user metadata with proper prefixing
      Object.entries(userInfo.metadata).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          attributes[`user.metadata.${key}`] = String(value);
        }
      });
    }
  }

  const sessionInfo = getSessionInfo(ctx);
  if (sessionInfo) {
    attributes['session.start_time'] = sessionInfo.startTime;
    if (sessionInfo.projectId) {
      attributes['project.id'] = sessionInfo.projectId;
    }
    if (sessionInfo.metadata) {
      // Add session metadata with proper prefixing
      Object.entries(sessionInfo.metadata).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          attributes[`session.metadata.${key}`] = String(value);
        }
      });
    }
  }

  const contextMetadata = getContextMetadata(ctx);
  if (contextMetadata) {
    if (contextMetadata.tags && Array.isArray(contextMetadata.tags)) {
      // OpenInference semantic convention for tags
      attributes['tag.tags'] = JSON.stringify(contextMetadata.tags);
      // Keep compatibility attributes
      attributes['context.tags'] = contextMetadata.tags.join(',');
      attributes['context.tags.count'] = contextMetadata.tags.length;
    }
    if (contextMetadata.environment) {
      attributes['context.environment'] = contextMetadata.environment;
    }
    if (contextMetadata.version) {
      attributes['context.version'] = contextMetadata.version;
    }

    // Add other metadata with proper prefixing
    const otherMetadata: Record<string, any> = {};
    Object.entries(contextMetadata).forEach(([key, value]) => {
      if (
        !['tags', 'environment', 'version'].includes(key) &&
        value !== null &&
        value !== undefined
      ) {
        attributes[`context.metadata.${key}`] = String(value);
        otherMetadata[key] = value;
      }
    });

    // OpenInference semantic convention for general metadata
    if (Object.keys(otherMetadata).length > 0) {
      attributes['metadata'] = JSON.stringify(otherMetadata);
    }
  }

  return attributes;
}
