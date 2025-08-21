import Bull from 'bull';
import { getDb, getTimescaleDb } from '../database';
import { logger } from '../utils/logger';

export async function cleanupWorker(job: Bull.Job) {
  const { type } = job.data;
  
  switch (type) {
    case 'cleanup-old-data':
      await cleanupOldData();
      break;
    case 'partition-maintenance':
      await maintainPartitions();
      break;
    default:
      logger.warn(`Unknown cleanup job type: ${type}`);
  }
}

async function cleanupOldData() {
  const db = getDb();
  
  try {
    // Clean up old sessions
    await db.query(`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
    `);
    
    // Clean up old activity logs (keep 90 days)
    await db.query(`
      DELETE FROM activity_logs
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);
    
    // Clean up old ML training data (keep 30 days)
    await db.query(`
      DELETE FROM ml_training_data
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    
    logger.info('Old data cleanup completed');
  } catch (error) {
    logger.error('Old data cleanup failed:', error);
    throw error;
  }
}

async function maintainPartitions() {
  const db = getDb();
  
  try {
    // Create new partitions for the next 7 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30); // Start from 30 days ahead
    
    for (let i = 0; i < 7; i++) {
      const partitionDate = new Date(startDate);
      partitionDate.setDate(partitionDate.getDate() + i);
      
      const partitionName = `traffic_logs_${partitionDate.toISOString().split('T')[0].replace(/-/g, '_')}`;
      const startRange = partitionDate.toISOString().split('T')[0];
      const endDate = new Date(partitionDate);
      endDate.setDate(endDate.getDate() + 1);
      const endRange = endDate.toISOString().split('T')[0];
      
      await db.query(`
        CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF traffic_logs
        FOR VALUES FROM ('${startRange}') TO ('${endRange}')
      `);
    }
    
    // Drop old partitions (older than 90 days)
    const dropDate = new Date();
    dropDate.setDate(dropDate.getDate() - 90);
    
    const result = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename LIKE 'traffic_logs_%'
        AND tablename < 'traffic_logs_${dropDate.toISOString().split('T')[0].replace(/-/g, '_')}'
    `);
    
    for (const row of result.rows) {
      await db.query(`DROP TABLE IF EXISTS ${row.tablename}`);
      logger.info(`Dropped old partition: ${row.tablename}`);
    }
    
    logger.info('Partition maintenance completed');
  } catch (error) {
    logger.error('Partition maintenance failed:', error);
    throw error;
  }
}