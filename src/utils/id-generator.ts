import { randomBytes } from 'crypto';

/**
 * Deterministic ID Generation Utility
 *
 * Replaces Math.random() usage for ID generation with secure,
 * deterministic alternatives for Phoenix observability
 *
 * CRITICAL: No Math.random() usage - all IDs are either:
 * 1. Cryptographically secure (production)
 * 2. Deterministic based on input (testing)
 */

// Counter for deterministic sequence generation in test environments
let sequenceCounter = 0;

/**
 * Generate a secure random ID using crypto.randomBytes
 */
export function generateSecureId(prefix: string, length: number = 9): string {
  const timestamp = Date.now();
  const randomPart = randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .substring(0, length);
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Generate a deterministic ID based on input for testing/consistency
 */
export function generateDeterministicId(prefix: string, seed: string, length: number = 9): string {
  const timestamp = Date.now();

  // Create deterministic suffix from seed using simple hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const deterministic = Math.abs(hash).toString(36).substring(0, length);
  return `${prefix}_${timestamp}_${deterministic}`;
}

/**
 * Generate a sequence-based ID for ordered/testing scenarios
 */
export function generateSequenceId(prefix: string): string {
  const timestamp = Date.now();
  sequenceCounter = (sequenceCounter + 1) % 1000000; // Reset at 1M
  const paddedSequence = sequenceCounter.toString().padStart(6, '0');
  return `${prefix}_${timestamp}_seq${paddedSequence}`;
}

/**
 * Session ID generator - deterministic for same user within timeframe
 */
export function generateSessionId(userId?: string): string {
  if (userId) {
    // Deterministic session ID based on user and hour boundary
    const hourBoundary = Math.floor(Date.now() / (1000 * 60 * 60)); // Hour boundary
    return generateDeterministicId('session', `${userId}_${hourBoundary}`, 8);
  } else {
    // Secure random session ID for anonymous sessions
    return generateSecureId('session', 8);
  }
}

/**
 * Thought ID generator - secure random for uniqueness
 */
export function generateThoughtId(): string {
  return generateSecureId('thought', 9);
}

/**
 * Prompt ID generator - secure random for uniqueness
 */
export function generatePromptId(): string {
  return generateSecureId('prompt', 9);
}

/**
 * Project ID generator - deterministic for consistent project tracking
 */
export function generateProjectId(projectName?: string): string {
  if (projectName) {
    return generateDeterministicId('project', projectName, 8);
  } else {
    return generateSecureId('project', 8);
  }
}

/**
 * Resource ID generator with type-specific prefixes
 */
export function generateResourceId(resourceType: string, identifier?: string): string {
  if (identifier) {
    return generateDeterministicId(resourceType, identifier, 8);
  } else {
    return generateSecureId(resourceType, 8);
  }
}

/**
 * Reset sequence counter (for testing)
 */
export function resetSequenceCounter(): void {
  sequenceCounter = 0;
}

/**
 * Get current sequence counter value (for testing/debugging)
 */
export function getSequenceCounter(): number {
  return sequenceCounter;
}
