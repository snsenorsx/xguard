import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

// Import high-performance connection pool manager
const { dbManager, pools } = require('./connection_pool.js');

let pool: Pool;
let timescalePool: Pool;

export async function initializeDatabase() {
  logger.info('Initializing high-performance database connections...');
  
  // Use optimized connection pools from connection_pool.js
  pool = pools.main;
  timescalePool = pools.timescale;

  // Backward compatibility - create basic pools if advanced pools not available
  if (!pool) {
    logger.info('Using fallback basic connection pool');
    // Main database pool with enhanced settings
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      
      // Enhanced connection pool settings
      min: 10,                    // Minimum connections
      max: 50,                    // Maximum connections  
      idleTimeoutMillis: 30000,   // 30 seconds
      connectionTimeoutMillis: 10000, // 10 seconds
      
      // PostgreSQL specific optimizations
      query_timeout: 30000,       // 30 second query timeout
      statement_timeout: 30000,   // 30 second statement timeout
      application_name: 'rpc-cloaker',
    });
  }

  if (!timescalePool) {
    // TimescaleDB pool for time-series data with enhanced settings
    timescalePool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.timescaleDb || config.database.database,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      
      min: 5,
      max: 25,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      
      query_timeout: 120000,      // 2 minute timeout for time-series queries
      statement_timeout: 120000,
      application_name: 'rpc-cloaker-timescale',
    });
  }

  // Test connections and apply optimizations
  try {
    // Test main connection
    const mainResult = await pool.query('SELECT NOW() as server_time, version() as postgres_version');
    logger.info('PostgreSQL connection established:', {
      serverTime: mainResult.rows[0].server_time,
      version: mainResult.rows[0].postgres_version.split(' ')[0]
    });
    
    // Test TimescaleDB connection  
    const tsResult = await timescalePool.query('SELECT NOW() as server_time');
    logger.info('TimescaleDB connection established:', {
      serverTime: tsResult.rows[0].server_time
    });
    
    // Apply session-level optimizations
    await applyDatabaseOptimizations();
    
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Apply database-level optimizations
async function applyDatabaseOptimizations() {
  try {
    // Create performance optimization indexes if they don't exist
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traffic_logs_hot_queries
      ON traffic_logs(campaign_id, created_at DESC, decision)
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days';
    `);
    
    // Refresh materialized views for better performance
    await pool.query(`
      SELECT CASE 
        WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_campaign_performance')
        THEN 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_campaign_performance'
        ELSE 'SELECT 1'
      END;
    `);
    
    logger.info('Database optimizations applied successfully');
  } catch (error) {
    logger.warn('Some database optimizations failed:', (error as Error).message);
  }
}

export function getDb() {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
}

export function getTimescaleDb() {
  if (!timescalePool) {
    throw new Error('TimescaleDB not initialized');
  }
  return timescalePool;
}

export async function closeDatabase() {
  logger.info('Closing database connections...');
  
  try {
    // Use advanced shutdown if available
    if (dbManager && typeof dbManager.shutdown === 'function') {
      await dbManager.shutdown();
    } else {
      // Fallback to basic shutdown
      if (pool) {
        await pool.end();
        logger.info('Main database pool closed');
      }
      if (timescalePool) {
        await timescalePool.end();
        logger.info('TimescaleDB pool closed');
      }
    }
    
    logger.info('All database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
}

// Export database manager for advanced operations
export { dbManager };

// High-performance query functions
export const query = async (text: string, params?: any[], options?: any) => {
  if (dbManager && typeof dbManager.query === 'function') {
    return dbManager.query('main', text, params, options);
  }
  return pool.query(text, params);
};

export const queryAnalytics = async (text: string, params?: any[], options?: any) => {
  if (dbManager && typeof dbManager.query === 'function') {
    return dbManager.query('analytics', text, params, options);
  }
  return pool.query(text, params);
};

export const queryReadonly = async (text: string, params?: any[], options?: any) => {
  if (dbManager && typeof dbManager.query === 'function') {
    return dbManager.query('readonly', text, params, options);
  }
  return pool.query(text, params);
};

export const transaction = async (callback: (client: any) => Promise<any>, options?: any) => {
  if (dbManager && typeof dbManager.transaction === 'function') {
    return dbManager.transaction('main', callback, options);
  }
  
  // Fallback transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Database health check
export const healthCheck = async () => {
  if (dbManager && typeof dbManager.healthCheck === 'function') {
    return dbManager.healthCheck();
  }
  
  // Basic health check
  try {
    const result = await pool.query('SELECT NOW() as timestamp, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].timestamp,
      version: result.rows[0].version,
      connections: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message
    };
  }
};