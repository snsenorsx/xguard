import Bull from 'bull';
import { config } from '../config';
import { logger } from '../utils/logger';
import { analyticsWorker } from './analytics.worker';
import { cleanupWorker } from './cleanup.worker';
import { mlSyncWorker } from './mlSync.worker';

const queues: Map<string, Bull.Queue> = new Map();

export async function initializeWorkers() {
  // Analytics aggregation queue
  const analyticsQueue = new Bull('analytics', {
    redis: {
      host: config.queue.redis.host,
      port: config.queue.redis.port,
    },
  });
  queues.set('analytics', analyticsQueue);
  analyticsQueue.process(5, analyticsWorker);
  
  // Cleanup queue
  const cleanupQueue = new Bull('cleanup', {
    redis: {
      host: config.queue.redis.host,
      port: config.queue.redis.port,
    },
  });
  queues.set('cleanup', cleanupQueue);
  cleanupQueue.process(cleanupWorker);
  
  // ML sync queue
  const mlSyncQueue = new Bull('mlSync', {
    redis: {
      host: config.queue.redis.host,
      port: config.queue.redis.port,
    },
  });
  queues.set('mlSync', mlSyncQueue);
  mlSyncQueue.process(10, mlSyncWorker);
  
  // Schedule recurring jobs
  await scheduleRecurringJobs();
  
  // Set up error handlers
  for (const [name, queue] of queues) {
    queue.on('error', (error) => {
      logger.error(`Queue ${name} error:`, error);
    });
    
    queue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} in queue ${name} failed:`, err);
    });
  }
  
  logger.info('Workers initialized successfully');
}

async function scheduleRecurringJobs() {
  const cleanupQueue = queues.get('cleanup');
  if (cleanupQueue) {
    // Run cleanup every hour
    await cleanupQueue.add(
      'cleanup-old-data',
      {},
      {
        repeat: {
          cron: '0 * * * *', // Every hour
        },
      }
    );
    
    // Run partition maintenance daily
    await cleanupQueue.add(
      'partition-maintenance',
      {},
      {
        repeat: {
          cron: '0 2 * * *', // 2 AM daily
        },
      }
    );
  }
  
  const analyticsQueue = queues.get('analytics');
  if (analyticsQueue) {
    // Aggregate stats every 5 minutes
    await analyticsQueue.add(
      'aggregate-stats',
      {},
      {
        repeat: {
          every: 5 * 60 * 1000, // 5 minutes
        },
      }
    );
  }
}

export async function getQueue(name: string): Promise<Bull.Queue | undefined> {
  return queues.get(name);
}

export async function closeWorkers() {
  for (const queue of queues.values()) {
    await queue.close();
  }
}