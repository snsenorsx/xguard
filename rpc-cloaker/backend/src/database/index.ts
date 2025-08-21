import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool;
let timescalePool: Pool;

export async function initializeDatabase() {
  // Main database pool
  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // TimescaleDB pool for time-series data
  timescalePool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.timescaleDb,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connections
  try {
    await pool.query('SELECT NOW()');
    logger.info('PostgreSQL connection established');
    
    await timescalePool.query('SELECT NOW()');
    logger.info('TimescaleDB connection established');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
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
  if (pool) {
    await pool.end();
  }
  if (timescalePool) {
    await timescalePool.end();
  }
}