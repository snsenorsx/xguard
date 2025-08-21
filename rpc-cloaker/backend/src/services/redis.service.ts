import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let redisClient: Redis;
let redisCluster: Redis.Cluster | null = null;

export async function initializeRedis() {
  // Check if cluster mode is enabled
  if (config.redis.clusterNodes && config.redis.clusterNodes.length > 0) {
    redisCluster = new Redis.Cluster(config.redis.clusterNodes, {
      redisOptions: {
        password: config.redis.password,
      },
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    redisCluster.on('connect', () => {
      logger.info('Redis cluster connected');
    });

    redisCluster.on('error', (err) => {
      logger.error('Redis cluster error:', err);
    });

    await redisCluster.ping();
  } else {
    // Single Redis instance
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    await redisClient.ping();
  }
}

export function getRedis(): Redis | Redis.Cluster {
  if (redisCluster) {
    return redisCluster;
  }
  if (!redisClient) {
    throw new Error('Redis not initialized');
  }
  return redisClient;
}

// Cache utilities
export class CacheService {
  private static prefix = 'rpc:';

  static async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const value = await redis.get(this.prefix + key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  static async set(key: string, value: any, ttl?: number): Promise<void> {
    const redis = getRedis();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await redis.setex(this.prefix + key, ttl, serialized);
    } else {
      await redis.set(this.prefix + key, serialized);
    }
  }

  static async del(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(this.prefix + key);
  }

  static async exists(key: string): Promise<boolean> {
    const redis = getRedis();
    const exists = await redis.exists(this.prefix + key);
    return exists === 1;
  }

  static async expire(key: string, ttl: number): Promise<void> {
    const redis = getRedis();
    await redis.expire(this.prefix + key, ttl);
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    let cursor = '0';
    const fullPattern = this.prefix + pattern;
    
    do {
      const [newCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        fullPattern,
        'COUNT',
        100
      );
      cursor = newCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  // Rate limiting
  static async rateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const redis = getRedis();
    const fullKey = `${this.prefix}ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - window * 1000;

    // Remove old entries
    await redis.zremrangebyscore(fullKey, '-inf', windowStart);

    // Count current entries
    const count = await redis.zcard(fullKey);

    if (count < limit) {
      // Add current request
      await redis.zadd(fullKey, now, `${now}-${Math.random()}`);
      await redis.expire(fullKey, window);
      
      return {
        allowed: true,
        remaining: limit - count - 1,
        resetAt: now + window * 1000,
      };
    }

    // Get oldest entry to determine reset time
    const oldest = await redis.zrange(fullKey, 0, 0, 'WITHSCORES');
    const resetAt = oldest.length > 1 ? parseInt(oldest[1]) + window * 1000 : now + window * 1000;

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }
}

export async function closeRedis() {
  if (redisCluster) {
    await redisCluster.quit();
  }
  if (redisClient) {
    await redisClient.quit();
  }
}