import Bull from 'bull';
import { getTimescaleDb } from '../database';
import { logger } from '../utils/logger';

export async function analyticsWorker(job: Bull.Job) {
  const jobName = job.name;
  
  switch (jobName) {
    case 'aggregate-stats':
      await aggregateStats();
      break;
    default:
      logger.warn(`Unknown analytics job type: ${jobName}`);
  }
}

async function aggregateStats() {
  const tsDb = getTimescaleDb();
  
  try {
    // Aggregate 1-minute stats from raw metrics
    await tsDb.query(`
      INSERT INTO stats_1m (time, campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms)
      SELECT 
        time_bucket('1 minute', time) as time,
        campaign_id,
        stream_id,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE tags->>'is_bot' = 'true') as bot_requests,
        COUNT(*) FILTER (WHERE tags->>'is_bot' = 'false') as human_requests,
        COUNT(*) FILTER (WHERE tags->>'page_shown' = 'money') as money_page_shown,
        COUNT(*) FILTER (WHERE tags->>'page_shown' = 'safe') as safe_page_shown,
        AVG((tags->>'response_time_ms')::float) as avg_response_time_ms
      FROM metrics
      WHERE time >= NOW() - INTERVAL '5 minutes'
        AND metric_type = 'page_view'
      GROUP BY time_bucket('1 minute', time), campaign_id, stream_id
      ON CONFLICT (time, campaign_id, stream_id) 
      DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        bot_requests = EXCLUDED.bot_requests,
        human_requests = EXCLUDED.human_requests,
        money_page_shown = EXCLUDED.money_page_shown,
        safe_page_shown = EXCLUDED.safe_page_shown,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms
    `);
    
    // Aggregate 1-hour stats from 1-minute stats
    await tsDb.query(`
      INSERT INTO stats_1h (time, campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms)
      SELECT 
        time_bucket('1 hour', time) as time,
        campaign_id,
        stream_id,
        SUM(total_requests) as total_requests,
        SUM(bot_requests) as bot_requests,
        SUM(human_requests) as human_requests,
        SUM(money_page_shown) as money_page_shown,
        SUM(safe_page_shown) as safe_page_shown,
        AVG(avg_response_time_ms) as avg_response_time_ms
      FROM stats_1m
      WHERE time >= NOW() - INTERVAL '2 hours'
      GROUP BY time_bucket('1 hour', time), campaign_id, stream_id
      ON CONFLICT (time, campaign_id, stream_id) 
      DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        bot_requests = EXCLUDED.bot_requests,
        human_requests = EXCLUDED.human_requests,
        money_page_shown = EXCLUDED.money_page_shown,
        safe_page_shown = EXCLUDED.safe_page_shown,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms
    `);
    
    // Aggregate 1-day stats from 1-hour stats
    await tsDb.query(`
      INSERT INTO stats_1d (time, campaign_id, stream_id, total_requests, bot_requests, human_requests, money_page_shown, safe_page_shown, avg_response_time_ms)
      SELECT 
        time_bucket('1 day', time) as time,
        campaign_id,
        stream_id,
        SUM(total_requests) as total_requests,
        SUM(bot_requests) as bot_requests,
        SUM(human_requests) as human_requests,
        SUM(money_page_shown) as money_page_shown,
        SUM(safe_page_shown) as safe_page_shown,
        AVG(avg_response_time_ms) as avg_response_time_ms
      FROM stats_1h
      WHERE time >= NOW() - INTERVAL '2 days'
      GROUP BY time_bucket('1 day', time), campaign_id, stream_id
      ON CONFLICT (time, campaign_id, stream_id) 
      DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        bot_requests = EXCLUDED.bot_requests,
        human_requests = EXCLUDED.human_requests,
        money_page_shown = EXCLUDED.money_page_shown,
        safe_page_shown = EXCLUDED.safe_page_shown,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms
    `);
    
    logger.info('Analytics aggregation completed');
  } catch (error) {
    logger.error('Analytics aggregation failed:', error);
    throw error;
  }
}