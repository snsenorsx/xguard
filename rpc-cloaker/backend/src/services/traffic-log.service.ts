/**
 * Traffic Log Service
 * Logs and tracks traffic for analytics
 */

import { getDb } from '../database';

interface TrafficLogData {
  campaignId: string;
  ipAddress: string;
  userAgent: string;
  decision: string;
  reason?: string;
  confidence: number;
  fingerprint?: any;
  headers: Record<string, string>;
  timestamp: Date;
}

export class TrafficLogService {
  static async log(data: TrafficLogData): Promise<void> {
    try {
      const db = getDb();
      
      await db.query(
        `INSERT INTO traffic_logs 
         (campaign_id, ip_address, user_agent, decision, reason, confidence, 
          fingerprint_data, headers, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          data.campaignId,
          data.ipAddress,
          data.userAgent,
          data.decision,
          data.reason || null,
          data.confidence,
          JSON.stringify(data.fingerprint || {}),
          JSON.stringify(data.headers),
          data.timestamp
        ]
      );
    } catch (error) {
      console.error('Failed to log traffic:', error);
      // Don't throw - logging shouldn't break the main flow
    }
  }

  static async getRecentLogs(limit = 100): Promise<any[]> {
    try {
      const db = getDb();
      const result = await db.query(
        `SELECT * FROM traffic_logs 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Failed to get recent logs:', error);
      return [];
    }
  }
}