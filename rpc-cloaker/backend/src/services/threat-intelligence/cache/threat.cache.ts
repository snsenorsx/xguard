/**
 * Threat Intelligence Cache
 * Manages caching for threat intelligence data
 */

import { ThreatIntelligenceResult } from '../types';

export class ThreatCache {
  private cache = new Map<string, CachedEntry>();
  private ttl: number;
  private namespace: string;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: {
    ttl: number;
    namespace: string;
    maxSize?: number;
  }) {
    this.ttl = config.ttl * 1000; // Convert to milliseconds
    this.namespace = config.namespace;
    this.maxSize = config.maxSize || 10000;

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Get cached result
   */
  get(ipAddress: string): ThreatIntelligenceResult | null {
    const key = this.generateKey(ipAddress);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.lastAccess = Date.now();
    
    return { ...entry.data, cached: true };
  }

  /**
   * Set cached result
   */
  set(ipAddress: string, result: ThreatIntelligenceResult): void {
    const key = this.generateKey(ipAddress);
    
    // Enforce size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      lastAccess: Date.now()
    });
  }

  /**
   * Check if IP is cached
   */
  has(ipAddress: string): boolean {
    const key = this.generateKey(ipAddress);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear specific IP from cache
   */
  delete(ipAddress: string): boolean {
    const key = this.generateKey(ipAddress);
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      size: this.cache.size,
      active,
      expired,
      maxSize: this.maxSize,
      namespace: this.namespace,
      ttl: this.ttl / 1000 // Convert back to seconds
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Generate cache key
   */
  private generateKey(ipAddress: string): string {
    return `${this.namespace}:${ipAddress}`;
  }

  /**
   * Destroy cache and clear intervals
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

interface CachedEntry {
  data: ThreatIntelligenceResult;
  timestamp: number;
  lastAccess: number;
}

interface CacheStats {
  size: number;
  active: number;
  expired: number;
  maxSize: number;
  namespace: string;
  ttl: number;
}