import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

async function migrate() {
  const mainPool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
  });

  const tsPool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.timescaleDb,
    user: config.database.user,
    password: config.database.password,
  });

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    await mainPool.query(schema);
    logger.info('Main database schema applied');

    const tsSchemaPath = join(__dirname, 'timescale-schema.sql');
    const tsSchema = readFileSync(tsSchemaPath, 'utf8');
    await tsPool.query(tsSchema);
    logger.info('Timescale schema applied');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mainPool.end();
    await tsPool.end();
  }
}

migrate();

