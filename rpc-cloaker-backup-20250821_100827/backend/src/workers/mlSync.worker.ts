import Bull from 'bull';
import axios from 'axios';
import { getDb } from '../database';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function mlSyncWorker(job: Bull.Job) {
  const { visitorData, decision } = job.data;
  
  try {
    // Send data to ML service for training
    await axios.post(
      `${config.mlService.url}/train`,
      {
        visitor: visitorData,
        decision: decision,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'X-API-Key': config.mlService.apiKey,
        },
        timeout: 5000,
      }
    );
    
    // Store in local training data table
    const db = getDb();
    await db.query(
      `INSERT INTO ml_training_data (visitor_fingerprint, features, label, confidence)
       VALUES ($1, $2, $3, $4)`,
      [
        visitorData.fingerprintHash,
        JSON.stringify({
          userAgent: visitorData.userAgent,
          headers: visitorData.headers,
          geo: visitorData.geo,
          device: visitorData.device,
          browser: visitorData.browser,
          os: visitorData.os,
        }),
        decision.decision === 'safe' ? 'bot' : 'human',
        decision.botScore || 0,
      ]
    );
    
    logger.debug('ML sync completed for visitor', { fingerprint: visitorData.fingerprintHash });
  } catch (error) {
    logger.error('ML sync failed:', error);
    // Don't throw - ML sync failures shouldn't affect the main system
  }
}