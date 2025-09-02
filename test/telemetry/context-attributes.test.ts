import {
  createUserInfo,
  createSessionInfo,
  setUserInfo,
  getUserInfo,
  setSessionInfo,
  getSessionInfo,
  setContextMetadata,
  getContextMetadata,
  withUserInfo,
  withSessionInfo,
  withContextMetadata,
  withFullContext,
  validateUserInfo,
  validateSessionInfo,
  extractSpanAttributes,
  UserInfo,
  SessionInfo,
  ContextMetadata,
} from '../../src/telemetry/context-attributes.js';
import { context, ROOT_CONTEXT } from '@opentelemetry/api';

describe('Context Attributes', () => {
  describe('User Info Management', () => {
    test('should create user info with deterministic session ID', () => {
      const userId = 'user123';
      const userAgent = 'test-agent/1.0';
      const projectId = 'project456';

      const userInfo = createUserInfo(userId, userAgent, projectId);

      expect(userInfo.userId).toBe(userId);
      expect(userInfo.userAgent).toBe(userAgent);
      expect(userInfo.sessionId).toMatch(/^session_\d+_user123$/);
      expect(userInfo.metadata?.projectId).toBe(projectId);
      expect(typeof userInfo.metadata?.createdAt).toBe('number');
    });

    test('should validate user info structure', () => {
      const validUserInfo: UserInfo = {
        userId: 'user123',
        sessionId: 'session_456',
      };

      const invalidUserInfo = {
        userId: '',
        sessionId: 'session_456',
      } as UserInfo;

      expect(validateUserInfo(validUserInfo)).toBe(true);
      expect(validateUserInfo(invalidUserInfo)).toBe(false);
    });

    test('should set and get user info from context', () => {
      const userInfo = createUserInfo('user123', 'agent/1.0');
      const ctx = setUserInfo(ROOT_CONTEXT, userInfo);
      const retrieved = getUserInfo(ctx);

      expect(retrieved).toEqual(userInfo);
    });

    test('should execute function with user context', () => {
      const userInfo = createUserInfo('user123');
      let retrievedUserInfo: UserInfo | undefined;

      withUserInfo(userInfo, () => {
        retrievedUserInfo = getUserInfo(context.active());
      });

      expect(retrievedUserInfo).toEqual(userInfo);
    });
  });

  describe('Session Info Management', () => {
    test('should create session info with proper tracking', () => {
      const sessionId = 'session_123';
      const projectId = 'project_456';
      const additionalMetadata = { version: '1.0.0' };

      const sessionInfo = createSessionInfo(sessionId, projectId, additionalMetadata);

      expect(sessionInfo.sessionId).toBe(sessionId);
      expect(sessionInfo.projectId).toBe(projectId);
      expect(sessionInfo.startTime).toBeGreaterThan(0);
      expect(sessionInfo.metadata?.version).toBe('1.0.0');
    });

    test('should validate session info structure', () => {
      const validSessionInfo: SessionInfo = {
        sessionId: 'session_123',
        startTime: Date.now(),
      };

      const invalidSessionInfo = {
        sessionId: '',
        startTime: 0,
      } as SessionInfo;

      expect(validateSessionInfo(validSessionInfo)).toBe(true);
      expect(validateSessionInfo(invalidSessionInfo)).toBe(false);
    });

    test('should set and get session info from context', () => {
      const sessionInfo = createSessionInfo('session_123', 'project_456');
      const ctx = setSessionInfo(ROOT_CONTEXT, sessionInfo);
      const retrieved = getSessionInfo(ctx);

      expect(retrieved).toEqual(sessionInfo);
    });

    test('should execute function with session context', () => {
      const sessionInfo = createSessionInfo('session_123');
      let retrievedSessionInfo: SessionInfo | undefined;

      withSessionInfo(sessionInfo, () => {
        retrievedSessionInfo = getSessionInfo(context.active());
      });

      expect(retrievedSessionInfo).toEqual(sessionInfo);
    });
  });

  describe('Context Metadata Management', () => {
    test('should handle context metadata', () => {
      const metadata: ContextMetadata = {
        tags: ['test', 'development'],
        environment: 'test',
        version: '1.0.0',
        customField: 'customValue',
      };

      const ctx = setContextMetadata(ROOT_CONTEXT, metadata);
      const retrieved = getContextMetadata(ctx);

      expect(retrieved).toEqual(metadata);
    });

    test('should execute function with metadata context', () => {
      const metadata: ContextMetadata = {
        tags: ['test'],
        environment: 'test',
      };
      let retrievedMetadata: ContextMetadata | undefined;

      withContextMetadata(metadata, () => {
        retrievedMetadata = getContextMetadata(context.active());
      });

      expect(retrievedMetadata).toEqual(metadata);
    });
  });

  describe('Full Context Integration', () => {
    test('should handle full context with user, session, and metadata', () => {
      const userInfo = createUserInfo('user123', 'agent/1.0');
      const sessionInfo = createSessionInfo('session_456', 'project_789');
      const metadata: ContextMetadata = {
        tags: ['test', 'integration'],
        environment: 'test',
        version: '1.0.0',
      };

      let retrievedUser: UserInfo | undefined;
      let retrievedSession: SessionInfo | undefined;
      let retrievedMetadata: ContextMetadata | undefined;

      withFullContext(userInfo, sessionInfo, metadata, () => {
        const currentContext = context.active();
        retrievedUser = getUserInfo(currentContext);
        retrievedSession = getSessionInfo(currentContext);
        retrievedMetadata = getContextMetadata(currentContext);
      });

      expect(retrievedUser).toEqual(userInfo);
      expect(retrievedSession).toEqual(sessionInfo);
      expect(retrievedMetadata).toEqual(metadata);
    });
  });

  describe('Span Attributes Extraction', () => {
    test('should extract span attributes from context with all information', () => {
      const userInfo = createUserInfo('user123', 'test-agent/1.0', 'project789');
      const sessionInfo = createSessionInfo('session_456', 'project_789', {
        version: '1.0.0',
        environment: 'test',
      });
      const metadata: ContextMetadata = {
        tags: ['cognitive', 'analysis'],
        environment: 'test',
        version: '1.0.0',
        customField: 'customValue',
      };

      let ctx = setUserInfo(ROOT_CONTEXT, userInfo);
      ctx = setSessionInfo(ctx, sessionInfo);
      ctx = setContextMetadata(ctx, metadata);

      const attributes = extractSpanAttributes(ctx);

      // Check user attributes
      expect(attributes['user.id']).toBe('user123');
      expect(attributes['user.agent']).toBe('test-agent/1.0');
      expect(attributes['session.id']).toBe(userInfo.sessionId);
      expect(attributes['user.metadata.projectId']).toBe('project789');
      expect(attributes['user.metadata.createdAt']).toBeDefined();

      // Check session attributes
      expect(attributes['session.start_time']).toBe(sessionInfo.startTime);
      expect(attributes['project.id']).toBe('project_789');
      expect(attributes['session.metadata.version']).toBe('1.0.0');
      expect(attributes['session.metadata.environment']).toBe('test');

      // Check context metadata attributes
      expect(attributes['context.tags']).toBe('cognitive,analysis');
      expect(attributes['context.tags.count']).toBe(2);
      expect(attributes['context.environment']).toBe('test');
      expect(attributes['context.version']).toBe('1.0.0');
      expect(attributes['context.metadata.customField']).toBe('customValue');
    });

    test('should handle empty context gracefully', () => {
      const attributes = extractSpanAttributes(ROOT_CONTEXT);
      expect(Object.keys(attributes)).toHaveLength(0);
    });

    test('should handle partial context information', () => {
      const userInfo = createUserInfo('user123');
      const ctx = setUserInfo(ROOT_CONTEXT, userInfo);

      const attributes = extractSpanAttributes(ctx);

      expect(attributes['user.id']).toBe('user123');
      expect(attributes['session.id']).toBe(userInfo.sessionId);
      expect(attributes['user.metadata.createdAt']).toBeDefined();
      // Should not have session or context metadata attributes
      expect(attributes['session.start_time']).toBeUndefined();
      expect(attributes['context.tags']).toBeUndefined();
    });

    test('should filter null and undefined values', () => {
      const userInfo: UserInfo = {
        userId: 'user123',
        sessionId: 'session_456',
        metadata: {
          validField: 'value',
          nullField: null,
          undefinedField: undefined,
        },
      };

      const ctx = setUserInfo(ROOT_CONTEXT, userInfo);
      const attributes = extractSpanAttributes(ctx);

      expect(attributes['user.metadata.validField']).toBe('value');
      expect(attributes['user.metadata.nullField']).toBeUndefined();
      expect(attributes['user.metadata.undefinedField']).toBeUndefined();
    });
  });

  describe('Deterministic Behavior', () => {
    test('should generate consistent session IDs for same input', () => {
      const userId = 'user123';

      // Mock Date.now to ensure consistent timestamps
      const originalNow = Date.now;
      const mockTime = 1234567890000;
      Date.now = jest.fn(() => mockTime);

      const userInfo1 = createUserInfo(userId);
      const userInfo2 = createUserInfo(userId);

      // Both should have the same session ID pattern with same timestamp
      expect(userInfo1.sessionId).toBe(`session_${mockTime}_user123`);
      expect(userInfo2.sessionId).toBe(`session_${mockTime}_user123`);

      Date.now = originalNow;
    });

    test('should not use Math.random in any functionality', () => {
      // Mock Math.random to throw error if called
      const originalRandom = Math.random;
      Math.random = jest.fn(() => {
        throw new Error('Math.random() should not be used in context attributes');
      });

      try {
        const userInfo = createUserInfo('user123', 'agent/1.0', 'project456');
        const sessionInfo = createSessionInfo('session_789', 'project_123');
        const metadata: ContextMetadata = {
          tags: ['test'],
          environment: 'test',
        };

        let ctx = setUserInfo(ROOT_CONTEXT, userInfo);
        ctx = setSessionInfo(ctx, sessionInfo);
        ctx = setContextMetadata(ctx, metadata);

        const attributes = extractSpanAttributes(ctx);

        expect(attributes['user.id']).toBe('user123');
        expect(attributes['session.start_time']).toBeDefined();
        expect(attributes['context.tags']).toBe('test');
      } finally {
        Math.random = originalRandom;
      }
    });
  });
});
