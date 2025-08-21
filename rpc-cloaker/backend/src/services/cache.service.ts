/**
 * Advanced Cache Service with Redis Optimization
 * High-performance caching with compression, serialization, and clustering
 */

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { promisify } from 'util';
import * as zlib from 'zlib';

// Compression utilities
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheOptions {
  ttl?: number;           // Time to live in seconds
  compress?: boolean;     // Enable compression for large values
  serialize?: boolean;    // Custom serialization
  tags?: string[];        // Cache tags for batch invalidation
  namespace?: string;     // Cache namespace
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  operations: number;
  connections: number;
  memory: {
    used: string;
    peak: string;
    fragmentation: number;
  };
}

class AdvancedCacheService {
  private redis!: Redis;
  private cluster: any = null;
  private subscriber!: Redis;
  private publisher!: Redis;
  private stats: CacheStats;
  private compressionThreshold = 1024; // Compress values > 1KB
  private maxValueSize = 1024 * 1024;  // Max 1MB per cache entry

  constructor() {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      operations: 0,
      connections: 0,
      memory: {
        used: '0',
        peak: '0',
        fragmentation: 0
      }
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing advanced cache service...');

      // Initialize Redis connection based on configuration
      if (process.env.REDIS_CLUSTER_NODES) {
        await this.initializeCluster();
      } else {
        await this.initializeSingle();
      }

      // Initialize pub/sub connections
      await this.initializePubSub();

      // Setup event handlers
      this.setupEventHandlers();

      // Start cache monitoring
      this.startMonitoring();

      logger.info('Advanced cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache service:', error);
      throw error;
    }
  }

  private async initializeCluster(): Promise<void> {
    const clusterNodesEnv = process.env.REDIS_CLUSTER_NODES || '';
    const clusterNodes = clusterNodesEnv.split(',').map(nodeStr => {
      const [host, port] = nodeStr.split(':');
      return { host, port: parseInt(port) };
    });

    this.cluster = new (Redis as any).Cluster(clusterNodes, {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        keepAlive: 30000,
      },
      clusterRetryDelayOnFailover: 100,
      clusterRetryDelayOnClusterDown: 300,
      clusterMaxRedirections: 16,
      maxRetriesPerRequest: 3,
    });

    this.redis = this.cluster;
    await this.redis.ping();
    logger.info('Redis cluster connected successfully');
  }

  private async initializeSingle(): Promise<void> {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      
      // Connection optimization
      connectTimeout: 10000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      keepAlive: 30000,
      
      // Connection pooling
      family: 4,
      
      // Reconnection strategy
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });

    await this.redis.ping();
    logger.info('Redis single instance connected successfully');
  }

  private async initializePubSub(): Promise<void> {
    // Separate connections for pub/sub to avoid blocking
    this.subscriber = this.redis.duplicate();
    this.publisher = this.redis.duplicate();

    // Subscribe to cache invalidation events
    await this.subscriber.subscribe('cache:invalidate');
    
    this.subscriber.on('message', (channel, message) => {
      if (channel === 'cache:invalidate') {
        this.handleCacheInvalidation(message);
      }
    });

    logger.info('Cache pub/sub initialized');
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Cache connected to Redis');
    });

    this.redis.on('disconnect', () => {
      logger.warn('Cache disconnected from Redis');
    });

    this.redis.on('error', (error) => {
      logger.error('Cache Redis error:', error);
    });

    this.redis.on('reconnecting', () => {
      logger.info('Cache reconnecting to Redis...');
    });
  }

  private startMonitoring(): void {
    // Update cache statistics every 30 seconds
    setInterval(async () => {
      try {
        await this.updateStats();
      } catch (error) {
        logger.warn('Failed to update cache stats:', error);
      }
    }, 30000);
  }

  /**
   * Get value from cache with advanced features
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const rawValue = await this.redis.get(fullKey);
      
      if (rawValue === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      // Deserialize and decompress if needed
      const value = await this.deserializeValue(rawValue);
      
      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn(`Slow cache get: ${key} took ${duration}ms`);
      }
      
      return value;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    } finally {
      this.stats.operations++;
      this.updateHitRate();
    }
  }

  /**
   * Set value in cache with advanced features
   */
  async set(
    key: string, 
    value: any, 
    ttl?: number, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const serializedValue = await this.serializeValue(value, options);
      
      // Check value size
      if (serializedValue.length > this.maxValueSize) {
        logger.warn(`Cache value too large for key ${key}: ${serializedValue.length} bytes`);
        return false;
      }
      
      // Set with TTL
      const effectiveTtl = ttl || options.ttl || 3600; // Default 1 hour
      await this.redis.setex(fullKey, effectiveTtl, serializedValue);
      
      // Add tags if specified
      if (options.tags && options.tags.length > 0) {
        await this.addTags(fullKey, options.tags);
      }
      
      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn(`Slow cache set: ${key} took ${duration}ms`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    } finally {
      this.stats.operations++;
    }
  }

  /**
   * Multi-get operation for better performance
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.namespace));
      const rawValues = await this.redis.mget(...fullKeys);
      
      const results = await Promise.all(
        rawValues.map(async (rawValue, index) => {
          if (rawValue === null) {
            this.stats.misses++;
            return null;
          }
          
          this.stats.hits++;
          return await this.deserializeValue(rawValue);
        })
      );
      
      this.stats.operations += keys.length;
      this.updateHitRate();
      
      return results;
    } catch (error) {
      logger.error('Cache mget error:', error);
      this.stats.misses += keys.length;
      this.stats.operations += keys.length;
      this.updateHitRate();
      return keys.map(() => null);
    }
  }

  /**
   * Multi-set operation for better performance
   */
  async mset(entries: Array<{key: string, value: any, ttl?: number}>, options: CacheOptions = {}): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key, options.namespace);
        const serializedValue = await this.serializeValue(entry.value, options);
        const ttl = entry.ttl || options.ttl || 3600;
        
        pipeline.setex(fullKey, ttl, serializedValue);
      }
      
      await pipeline.exec();
      this.stats.operations += entries.length;
      
      return true;
    } catch (error) {
      logger.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Delete single key
   */
  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis.del(fullKey);
      this.stats.operations++;
      
      return result > 0;
    } catch (error) {
      logger.error(`Cache del error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async mdel(keys: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options.namespace));
      const result = await this.redis.del(...fullKeys);
      this.stats.operations += keys.length;
      
      return result;
    } catch (error) {
      logger.error('Cache mdel error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0;
      
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
          
          // Clean up tag set
          await this.redis.del(tagKey);
        }
      }
      
      // Publish invalidation event
      await this.publisher.publish('cache:invalidate', JSON.stringify({
        type: 'tags',
        tags: tags,
        timestamp: Date.now()
      }));
      
      return deletedCount;
    } catch (error) {
      logger.error('Cache tag invalidation error:', error);
      return 0;
    }
  }

  /**
   * Flush entire cache or namespace
   */
  async flush(namespace?: string): Promise<boolean> {
    try {
      if (namespace) {
        const pattern = `${namespace}:*`;
        const keys = await this.redis.keys(pattern);
        
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        await this.redis.flushdb();
      }
      
      logger.info(`Cache flushed${namespace ? ` for namespace: ${namespace}` : ''}`);
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.updateStats();
    return { ...this.stats };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{status: string, latency: number, memory: any}> {
    const startTime = Date.now();
    
    try {
      await this.redis.ping();
      const latency = Date.now() - startTime;
      
      const memory = await this.redis.memory('USAGE', 'test-key');
      
      return {
        status: 'healthy',
        latency,
        memory: this.stats.memory
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - startTime,
        memory: null
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down cache service...');
    
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.publisher) {
        await this.publisher.quit();
      }
      if (this.redis) {
        await this.redis.quit();
      }
      
      logger.info('Cache service shutdown complete');
    } catch (error) {
      logger.error('Error during cache shutdown:', error);
    }
  }

  // Private helper methods

  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || 'default';
    return `${ns}:${key}`;
  }

  private async serializeValue(value: any, options: CacheOptions): Promise<string> {
    try {
      let serialized = JSON.stringify(value);
      
      // Compress if value is large and compression is enabled
      if (options.compress !== false && serialized.length > this.compressionThreshold) {
        const compressed = await gzip(Buffer.from(serialized));
        serialized = `gzip:${compressed.toString('base64')}`;
      }
      
      return serialized;
    } catch (error) {
      logger.error('Cache serialization error:', error);
      throw error;
    }
  }

  private async deserializeValue(rawValue: string): Promise<any> {
    try {
      // Check if value is compressed
      if (rawValue.startsWith('gzip:')) {
        const compressedData = Buffer.from(rawValue.slice(5), 'base64');
        const decompressed = await gunzip(compressedData);
        return JSON.parse(decompressed.toString());
      }
      
      return JSON.parse(rawValue);
    } catch (error) {
      logger.error('Cache deserialization error:', error);
      return null;
    }
  }

  private async addTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, 86400); // Tag expires in 24 hours
    }
    
    await pipeline.exec();
  }

  private async updateStats(): Promise<void> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const peakMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);
      const fragMatch = info.match(/mem_fragmentation_ratio:([^\r\n]+)/);
      
      this.stats.memory = {
        used: memoryMatch ? memoryMatch[1] : '0',
        peak: peakMatch ? peakMatch[1] : '0',
        fragmentation: fragMatch ? parseFloat(fragMatch[1]) : 0
      };
      
      const clients = await this.redis.info('clients');
      const clientsMatch = clients.match(/connected_clients:([^\r\n]+)/);
      this.stats.connections = clientsMatch ? parseInt(clientsMatch[1]) : 0;
      
    } catch (error) {
      logger.warn('Failed to update cache stats:', error);
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private handleCacheInvalidation(message: string): void {
    try {
      const event = JSON.parse(message);
      logger.debug('Cache invalidation event received:', event);
      
      // Handle different types of invalidation events
      // This is useful for multi-instance cache synchronization
    } catch (error) {
      logger.error('Error handling cache invalidation:', error);
    }
  }
}

// Create singleton instance
export const cacheService = new AdvancedCacheService();

// Export function to get cache service instance
export function getCacheService(): AdvancedCacheService {
  return cacheService;
}

// Backward compatibility
export class CacheService {
  static async get<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    const value = await cacheService.get<T>(key);
    return value !== null ? value : defaultValue;
  }

  static async set(key: string, value: any, ttl = 3600): Promise<void> {
    await cacheService.set(key, value, ttl);
  }

  static async del(key: string): Promise<void> {
    await cacheService.del(key);
  }

  static async flush(): Promise<void> {
    await cacheService.flush();
  }
}