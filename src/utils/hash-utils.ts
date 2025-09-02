/**
 * Hash utility functions for deterministic string-to-number conversion
 */

/**
 * Simple hash function for deterministic string-to-number conversion
 * Uses a 32-bit djb2-style hash algorithm
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a normalized hash value between 0 and 1
 */
export function normalizedHash(str: string): number {
  return (hashString(str) % 1000) / 1000;
}

/**
 * Generate a hash value within a specific range
 */
export function rangeHash(str: string, min: number, max: number): number {
  const normalized = normalizedHash(str);
  return min + normalized * (max - min);
}
