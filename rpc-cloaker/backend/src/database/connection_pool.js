/**
 * Advanced Database Connection Pool Configuration
 * High-performance connection pooling for massive scale RPC cloaker
 */

const { Pool } = require('pg');
const config = require('../config');

// Connection pool configurations for different use cases
const poolConfigurations = {
  // Main application pool - optimized for high throughput
  main: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    
    // Connection pool settings
    min: 10,                    // Minimum connections always open
    max: 50,                    // Maximum connections in pool
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Wait 10s for connection
    
    // Advanced pool settings
    acquireTimeoutMillis: 60000,    // Max time to wait for connection
    createTimeoutMillis: 30000,     // Max time to create new connection
    destroyTimeoutMillis: 5000,     // Max time to destroy connection
    reapIntervalMillis: 1000,       // Check for idle connections every 1s
    createRetryIntervalMillis: 200, // Retry failed connections after 200ms
    
    // PostgreSQL specific optimizations
    ssl: false,
    query_timeout: 30000,       // 30 second query timeout
    statement_timeout: 30000,   // 30 second statement timeout
    application_name: 'rpc-cloaker-main',
    
    // Connection validation
    testOnBorrow: true,
    validationQuery: 'SELECT 1',
  },

  // Analytics pool - optimized for complex queries
  analytics: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    
    min: 2,
    max: 15,
    idleTimeoutMillis: 60000,   // Keep analytics connections longer
    connectionTimeoutMillis: 15000,
    
    query_timeout: 300000,      // 5 minute timeout for analytics queries
    statement_timeout: 300000,
    application_name: 'rpc-cloaker-analytics',
  },

  // Read-only replica pool (if available)
  readonly: {
    host: config.database.readonlyHost || config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.readonlyUser || config.database.user,
    password: config.database.readonlyPassword || config.database.password,
    
    min: 5,
    max: 25,
    idleTimeoutMillis: 45000,
    connectionTimeoutMillis: 10000,
    
    query_timeout: 60000,
    statement_timeout: 60000,
    application_name: 'rpc-cloaker-readonly',
  },

  // TimescaleDB pool for metrics (if using separate instance)
  timescale: {
    host: config.timescale?.host || config.database.host,
    port: config.timescale?.port || config.database.port,
    database: config.timescale?.database || config.database.name,
    user: config.timescale?.user || config.database.user,
    password: config.timescale?.password || config.database.password,
    
    min: 3,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    
    query_timeout: 120000,      // 2 minute timeout for time-series queries
    statement_timeout: 120000,
    application_name: 'rpc-cloaker-timescale',
  }
};

// Create connection pools
const pools = {};

function createPool(name, config) {
  const pool = new Pool(config);
  
  // Pool event handlers
  pool.on('connect', (client) => {
    console.log(`Database connected to ${name} pool (PID: ${client.processID})`);
    
    // Set session-level optimizations
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
  
  pool.on('acquire', (client) => {
    console.log(`Connection acquired from ${name} pool (PID: ${client.processID})`);
  });
  
  pool.on('remove', (client) => {
    console.log(`Connection removed from ${name} pool (PID: ${client.processID})`);
  });
  
  pool.on('error', (err, client) => {
    console.error(`Database error in ${name} pool:`, err);
    console.error(`Client PID: ${client?.processID || 'unknown'}`);
  });
  
  return pool;
}

// Initialize pools
Object.entries(poolConfigurations).forEach(([name, config]) => {
  pools[name] = createPool(name, config);
});

// Pool health monitoring
function getPoolStats() {
  const stats = {};
  
  Object.entries(pools).forEach(([name, pool]) => {
    stats[name] = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      maxConnections: pool.options.max,
      minConnections: pool.options.min,
    };
  });
  
  return stats;
}

// Connection pool wrapper with automatic retry and circuit breaker
class DatabaseManager {
  constructor() {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      isOpen: false,
      threshold: 5,        // Open circuit after 5 failures
      timeout: 30000,      // Reset circuit after 30 seconds
    };
  }

  async query(poolName, text, params, options = {}) {
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
        // Set query-specific timeouts if provided
        if (options.timeout) {
          await client.query(`SET statement_timeout = ${options.timeout}`);
        }
        
        const result = await client.query(text, params);
        const duration = Date.now() - startTime;
        
        // Log slow queries
        if (duration > 1000) {
          console.warn(`Slow query detected (${duration}ms):`, {
            pool: poolName,
            query: text.substring(0, 100),
            duration
          });
        }
        
        // Reset circuit breaker on success
        this.circuitBreaker.failures = 0;
        
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('Database query error:', {
        pool: poolName,
        error: error.message,
        duration,
        query: text.substring(0, 100)
      });
      
      // Update circuit breaker
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailure = Date.now();
      
      if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
        this.circuitBreaker.isOpen = true;
        console.error('Circuit breaker opened due to repeated failures');
      }
      
      throw error;
    }
  }

  // Transaction wrapper with automatic retry
  async transaction(poolName, callback, options = {}) {
    const pool = pools[poolName] || pools.main;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Set transaction isolation level if specified
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

  // Prepared statement cache
  async preparedQuery(poolName, name, text, params) {
    const pool = pools[poolName] || pools.main;
    const client = await pool.connect();
    
    try {
      // Check if statement is already prepared
      const result = await client.query({
        name: name,
        text: text,
        values: params
      });
      
      return result;
    } finally {
      client.release();
    }
  }

  // Bulk insert optimization
  async bulkInsert(tableName, columns, values, options = {}) {
    const poolName = options.pool || 'main';
    const batchSize = options.batchSize || 1000;
    
    if (values.length === 0) return;
    
    // Process in batches to avoid memory issues
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

  // Streaming results for large datasets
  async stream(poolName, text, params) {
    const pool = pools[poolName] || pools.readonly;
    const client = await pool.connect();
    
    try {
      const query = new QueryStream(text, params);
      const stream = client.query(query);
      
      // Release connection when stream ends
      stream.on('end', () => client.release());
      stream.on('error', () => client.release());
      
      return stream;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  // Health check for all pools
  async healthCheck() {
    const health = {};
    
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
          error: error.message,
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

  // Graceful shutdown
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
module.exports = {
  pools,
  dbManager,
  getPoolStats,
  
  // Convenience methods
  query: (text, params, options) => dbManager.query('main', text, params, options),
  queryAnalytics: (text, params, options) => dbManager.query('analytics', text, params, options),
  queryReadonly: (text, params, options) => dbManager.query('readonly', text, params, options),
  queryTimescale: (text, params, options) => dbManager.query('timescale', text, params, options),
  
  transaction: (callback, options) => dbManager.transaction('main', callback, options),
  bulkInsert: (table, columns, values, options) => dbManager.bulkInsert(table, columns, values, options),
  
  healthCheck: () => dbManager.healthCheck(),
  shutdown: () => dbManager.shutdown(),
};

// Handle process termination
process.on('SIGINT', dbManager.shutdown);
process.on('SIGTERM', dbManager.shutdown);