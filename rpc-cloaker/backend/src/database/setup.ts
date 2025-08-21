import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

async function setupDatabase() {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: 'postgres', // Connect to default database first
  });

  try {
    // Create main database if not exists
    const dbCheckResult = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database.database]
    );

    if (dbCheckResult.rows.length === 0) {
      await pool.query(`CREATE DATABASE ${config.database.database}`);
      logger.info(`Created database: ${config.database.database}`);
    }

    // Create TimescaleDB database if not exists
    const tsDbCheckResult = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database.timescaleDb]
    );

    if (tsDbCheckResult.rows.length === 0) {
      await pool.query(`CREATE DATABASE ${config.database.timescaleDb}`);
      logger.info(`Created database: ${config.database.timescaleDb}`);
    }

    await pool.end();

    // Connect to main database and run schema
    const mainPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
    });

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await mainPool.query(schema);
    logger.info('Main database schema created successfully');

    await mainPool.end();

    // Connect to TimescaleDB and run schema
    const tsPool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.timescaleDb,
      user: config.database.user,
      password: config.database.password,
    });

    const tsSchemaPath = join(__dirname, 'timescale-schema.sql');
    const tsSchema = readFileSync(tsSchemaPath, 'utf8');
    
    await tsPool.query(tsSchema);
    logger.info('TimescaleDB schema created successfully');

    await tsPool.end();

    logger.info('Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();