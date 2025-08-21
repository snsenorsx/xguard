/**
 * Database Connection Pool Configuration
 * High-performance connection pooling for RPC cloaker
 */

import { Pool, PoolConfig } from 'pg';
import { config } from '../config';

interface PoolConfigurations {
  [key: string]: PoolConfig;
}

// Connection pool configurations
const poolConfigurations: PoolConfigurations = {
  main: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    
    min: 10,
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    
    query_timeout: 30000,
    statement_timeout: 30000,
    application_name: 'rpc-cloaker-main',
  },

  analytics: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    
    min: 2,
    max: 15,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 15000,
    
    query_timeout: 300000,
    statement_timeout: 300000,
    application_name: 'rpc-cloaker-analytics',
  },

  readonly: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    
    min: 5,
    max: 25,
    idleTimeoutMillis: 45000,
    connectionTimeoutMillis: 10000,
    
    query_timeout: 60000,
    statement_timeout: 60000,
    application_name: 'rpc-cloaker-readonly',
  },

  timescale: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.timescaleDb || config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    
    min: 3,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    
    query_timeout: 120000,
    statement_timeout: 120000,
    application_name: 'rpc-cloaker-timescale',
  }
};

// Create connection pools
interface Pools {
  [key: string]: Pool;
}

const pools: Pools = {};

function createPool(name: string, config: PoolConfig): Pool {
  const pool = new Pool(config);
  
  pool.on('connect', (client) => {
    console.log(`Database connected to ${name} pool`);
    
    client.query(`
      SET temp_buffers = '32MB';
      SET work_mem = '64MB';
      SET maintenance_work_mem = '256MB';
      SET random_page_cost = 1.1;
      SET effective_io_concurrency = 200;
    `).catch(err => {
      console.error('Error setting session parameters:', err);
    });
  });
  
  pool.on('error', (err) => {
    console.error(`Database error in ${name} pool:`, err);
  });
  
  return pool;
}

// Initialize pools
Object.entries(poolConfigurations).forEach(([name, config]) => {
  pools[name] = createPool(name, config);
});

// Database manager class
class DatabaseManager {
  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    threshold: 5,
    timeout: 30000,
  };

  async query(poolName: string, text: string, params?: any[], options: any = {}) {
    const pool = pools[poolName] || pools.main;
    const startTime = Date.now();
    
    // Circuit breaker check
    if (this.circuitBreaker.isOpen) {
      const now = Date.now();
      if (now - this.circuitBreaker.lastFailure < this.circuitBreaker.timeout) {
        throw new Error('Circuit breaker is open');
      } else {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      }
    }
    
    try {
      const client = await pool.connect();
      
      try {
        if (options.timeout) {
          await client.query(`SET statement_timeout = ${options.timeout}`);
        }
        
        const result = await client.query(text, params);
        const duration = Date.now() - startTime;
        
        if (duration > 1000) {
          console.warn(`Slow query detected (${duration}ms):`, {
            pool: poolName,
            query: text.substring(0, 100),
            duration
          });
        }
        
        this.circuitBreaker.failures = 0;
        
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('Database query error:', {
        pool: poolName,
        error: (error as Error).message,
        duration,
        query: text.substring(0, 100)
      });
      
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        console.error('Circuit breaker opened due to repeated failures');
      }
      
      throw error;
    }
  }

  async transaction(poolName: string, callback: (client: any) => Promise<any>, options: any = {}) {
    const pool = pools[poolName] || pools.main;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      if (options.isolation) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolation}`);
      }
      
      const result = await callback(client);
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async bulkInsert(tableName: string, columns: string[], values: any[], options: any = {}) {
    const poolName = options.pool || 'main';
    const batchSize = options.batchSize || 1000;
    
    if (values.length === 0) return;
    
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      
      const placeholders = batch.map((_, rowIndex) => 
        `(${columns.map((_, colIndex) => 
          `$${rowIndex * columns.length + colIndex + 1}`
        ).join(', ')})`
      ).join(', ');
      
      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
      const params = batch.flat();
      
      await this.query(poolName, query, params, options);
    }
  }

  async healthCheck() {
    const health: any = {};
    
    for (const [name, pool] of Object.entries(pools)) {
      try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as server_time');
        client.release();
        
        health[name] = {
          status: 'healthy',
          serverTime: result.rows[0].server_time,
          stats: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
          }
        };
      } catch (error) {
        health[name] = {
          status: 'unhealthy',
          error: (error as Error).message,
          stats: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
          }
        };
      }
    }
    
    return health;
  }

  async shutdown() {
    console.log('Shutting down database connections...');
    
    const shutdownPromises = Object.entries(pools).map(async ([name, pool]) => {
      try {
        await pool.end();
        console.log(`${name} pool closed successfully`);
      } catch (error) {
        console.error(`Error closing ${name} pool:`, error);
      }
    });
    
    await Promise.all(shutdownPromises);
    console.log('All database pools closed');
  }
}

// Create singleton instance
const dbManager = new DatabaseManager();

// Export connection pools and manager
export { pools, dbManager };

// Convenience methods
export const query = (text: string, params?: any[], options?: any) => 
  dbManager.query('main', text, params, options);

export const queryAnalytics = (text: string, params?: any[], options?: any) => 
  dbManager.query('analytics', text, params, options);

export const queryReadonly = (text: string, params?: any[], options?: any) => 
  dbManager.query('readonly', text, params, options);

export const queryTimescale = (text: string, params?: any[], options?: any) => 
  dbManager.query('timescale', text, params, options);

export const transaction = (callback: any, options?: any) => 
  dbManager.transaction('main', callback, options);

export const bulkInsert = (table: string, columns: string[], values: any[], options?: any) => 
  dbManager.bulkInsert(table, columns, values, options);

export const healthCheck = () => dbManager.healthCheck();
export const shutdown = () => dbManager.shutdown();

// Handle process termination
process.on('SIGINT', dbManager.shutdown);
process.on('SIGTERM', dbManager.shutdown);