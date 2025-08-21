import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

export interface BlacklistEntry {
  id: string;
  ipAddress: string;
  reason: string;
  detectionType: 'bot' | 'suspicious' | 'manual';
  confidenceScore: number;
  detectionCount: number;
  firstDetected: Date;
  lastDetected: Date;
  expiresAt?: Date;
  isPermanent: boolean;
  campaignId?: string;
  userId?: string;
}

export interface IPReputation {
  ipAddress: string;
  reputationScore: number; // 0-100
  totalDetections: number;
  lastActivity: Date;
  riskCategory: 'low' | 'medium' | 'high' | 'critical';
  dataSources: string[];
}

interface DatabaseInterface {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export class BlacklistService {
  private db: DatabaseInterface;
  private redis: Redis;
  private cachePrefix = 'blacklist:';
  private cacheExpiry = 3600; // 1 hour

  constructor(db: DatabaseInterface, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  /**
   * Check if IP is blacklisted (with Redis cache)
   */
  async isBlacklisted(ipAddress: string): Promise<boolean> {
    try {
      // Check Redis cache first
      const cacheKey = `${this.cachePrefix}${ipAddress}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached !== null) {
        return cached === 'true';
      }

      // Check database
      const result = await this.db.query(`
        SELECT 1 FROM ip_blacklist 
        WHERE ip_address = $1 
        AND (is_permanent = TRUE OR expires_at > NOW())
        LIMIT 1
      `, [ipAddress]);

      const isBlacklisted = result.rows.length > 0;

      // Cache result
      await this.redis.setex(cacheKey, this.cacheExpiry, isBlacklisted.toString());

      return isBlacklisted;
    } catch (error) {
      console.error('Error checking blacklist:', error);
      return false; // Fail open for availability
    }
  }

  /**
   * Add IP to blacklist
   */
  async addToBlacklist(params: {
    ipAddress: string;
    reason: string;
    detectionType: 'bot' | 'suspicious' | 'manual';
    confidenceScore?: number;
    expiresAt?: Date;
    isPermanent?: boolean;
    campaignId?: string;
    userId?: string;
  }): Promise<BlacklistEntry> {
    const {
      ipAddress,
      reason,
      detectionType,
      confidenceScore = 0.0,
      expiresAt,
      isPermanent = false,
      campaignId,
      userId
    } = params;

    try {
      // Check if IP already exists
      const existing = await this.db.query(`
        SELECT * FROM ip_blacklist WHERE ip_address = $1
      `, [ipAddress]);

      let result;
      
      if (existing.rows.length > 0) {
        // Update existing entry
        result = await this.db.query(`
          UPDATE ip_blacklist 
          SET 
            detection_count = detection_count + 1,
            last_detected = NOW(),
            reason = $2,
            confidence_score = GREATEST(confidence_score, $3),
            expires_at = CASE 
              WHEN $4::timestamp IS NOT NULL THEN $4::timestamp
              WHEN is_permanent THEN NULL
              ELSE expires_at
            END,
            is_permanent = $5 OR is_permanent
          WHERE ip_address = $1
          RETURNING *
        `, [ipAddress, reason, confidenceScore, expiresAt, isPermanent]);
      } else {
        // Insert new entry
        result = await this.db.query(`
          INSERT INTO ip_blacklist (
            ip_address, reason, detection_type, confidence_score,
            expires_at, is_permanent, campaign_id, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `, [ipAddress, reason, detectionType, confidenceScore, expiresAt, isPermanent, campaignId, userId]);
      }

      const entry = result.rows[0];

      // Log event
      await this.logBlacklistEvent({
        ipAddress,
        eventType: existing.rows.length > 0 ? 'updated' : 'added',
        reason,
        userId,
        campaignId,
        metadata: { detectionType, confidenceScore }
      });

      // Update IP reputation
      await this.updateIPReputation(ipAddress, detectionType, confidenceScore);

      // Invalidate cache
      await this.redis.del(`${this.cachePrefix}${ipAddress}`);

      return this.mapDbRowToBlacklistEntry(entry);
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      throw error;
    }
  }

  /**
   * Remove IP from blacklist
   */
  async removeFromBlacklist(ipAddress: string, userId?: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        DELETE FROM ip_blacklist WHERE ip_address = $1 RETURNING *
      `, [ipAddress]);

      if (result.rows.length > 0) {
        // Log event
        await this.logBlacklistEvent({
          ipAddress,
          eventType: 'removed',
          reason: 'Manual removal',
          userId
        });

        // Invalidate cache
        await this.redis.del(`${this.cachePrefix}${ipAddress}`);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      throw error;
    }
  }

  /**
   * Get blacklisted IPs with pagination
   */
  async getBlacklistedIPs(params: {
    page?: number;
    limit?: number;
    search?: string;
    detectionType?: string;
  } = {}): Promise<{ entries: BlacklistEntry[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 50, search, detectionType } = params;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE (is_permanent = TRUE OR expires_at > NOW())';
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (ip_address::text ILIKE $${paramIndex} OR reason ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (detectionType) {
      whereClause += ` AND detection_type = $${paramIndex}`;
      queryParams.push(detectionType);
      paramIndex++;
    }

    try {
      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*) as total FROM ip_blacklist ${whereClause}
      `, queryParams);

      // Get entries
      const entriesResult = await this.db.query(`
        SELECT * FROM ip_blacklist 
        ${whereClause}
        ORDER BY last_detected DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset]);

      const entries = entriesResult.rows.map(row => this.mapDbRowToBlacklistEntry(row));
      const total = parseInt(countResult.rows[0].total);

      return { entries, total, page, limit };
    } catch (error) {
      console.error('Error getting blacklisted IPs:', error);
      throw error;
    }
  }

  /**
   * Get IP reputation
   */
  async getIPReputation(ipAddress: string): Promise<IPReputation | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM ip_reputation WHERE ip_address = $1
      `, [ipAddress]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        ipAddress: row.ip_address,
        reputationScore: row.reputation_score,
        totalDetections: row.total_detections,
        lastActivity: row.last_activity,
        riskCategory: row.risk_category,
        dataSources: row.data_sources || []
      };
    } catch (error) {
      console.error('Error getting IP reputation:', error);
      return null;
    }
  }

  /**
   * Clean expired blacklist entries
   */
  async cleanExpiredEntries(): Promise<number> {
    try {
      const result = await this.db.query('SELECT clean_expired_blacklist()');
      const deletedCount = result.rows[0].clean_expired_blacklist;

      // Clear cache for performance (could be more targeted)
      const keys = await this.redis.keys(`${this.cachePrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning expired entries:', error);
      return 0;
    }
  }

  /**
   * Get blacklist statistics
   */
  async getStatistics(): Promise<{
    totalBlacklisted: number;
    activeBots: number;
    expiringSoon: number;
    permanentBans: number;
    recentDetections: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_permanent = TRUE OR expires_at > NOW()) as total_blacklisted,
          COUNT(*) FILTER (WHERE detection_type = 'bot' AND (is_permanent = TRUE OR expires_at > NOW())) as active_bots,
          COUNT(*) FILTER (WHERE expires_at > NOW() AND expires_at < NOW() + INTERVAL '24 hours') as expiring_soon,
          COUNT(*) FILTER (WHERE is_permanent = TRUE) as permanent_bans,
          COUNT(*) FILTER (WHERE last_detected > NOW() - INTERVAL '24 hours') as recent_detections
        FROM ip_blacklist
      `);

      const row = result.rows[0];
      return {
        totalBlacklisted: parseInt(row.total_blacklisted),
        activeBots: parseInt(row.active_bots),
        expiringSoon: parseInt(row.expiring_soon),
        permanentBans: parseInt(row.permanent_bans),
        recentDetections: parseInt(row.recent_detections)
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  }

  /**
   * Update IP reputation based on detection
   */
  private async updateIPReputation(
    ipAddress: string, 
    detectionType: string, 
    confidenceScore: number
  ): Promise<void> {
    try {
      const scoreDeduction = this.getReputationDeduction(detectionType, confidenceScore);
      
      await this.db.query(`
        INSERT INTO ip_reputation (ip_address, reputation_score, total_detections, risk_category, data_sources)
        VALUES ($1, $2, 1, $3, $4)
        ON CONFLICT (ip_address) DO UPDATE SET
          reputation_score = GREATEST(0, ip_reputation.reputation_score - $2),
          total_detections = ip_reputation.total_detections + 1,
          last_activity = NOW(),
          risk_category = CASE 
            WHEN GREATEST(0, ip_reputation.reputation_score - $2) < 25 THEN 'critical'
            WHEN GREATEST(0, ip_reputation.reputation_score - $2) < 50 THEN 'high'
            WHEN GREATEST(0, ip_reputation.reputation_score - $2) < 75 THEN 'medium'
            ELSE 'low'
          END,
          data_sources = array_append(
            COALESCE(data_sources, '{}'), 
            $5::text
          )
      `, [
        ipAddress, 
        scoreDeduction, 
        this.getRiskCategory(100 - scoreDeduction),
        [detectionType],
        `rpc-cloaker-${detectionType}`
      ]);
    } catch (error) {
      console.error('Error updating IP reputation:', error);
    }
  }

  /**
   * Log blacklist events for analytics
   */
  private async logBlacklistEvent(params: {
    ipAddress: string;
    eventType: string;
    reason: string;
    userId?: string;
    campaignId?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO blacklist_events (ip_address, event_type, reason, user_id, campaign_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        params.ipAddress,
        params.eventType,
        params.reason,
        params.userId,
        params.campaignId,
        JSON.stringify(params.metadata || {})
      ]);
    } catch (error) {
      console.error('Error logging blacklist event:', error);
    }
  }

  /**
   * Helper: Map database row to BlacklistEntry
   */
  private mapDbRowToBlacklistEntry(row: any): BlacklistEntry {
    return {
      id: row.id,
      ipAddress: row.ip_address,
      reason: row.reason,
      detectionType: row.detection_type,
      confidenceScore: row.confidence_score,
      detectionCount: row.detection_count,
      firstDetected: row.first_detected,
      lastDetected: row.last_detected,
      expiresAt: row.expires_at,
      isPermanent: row.is_permanent,
      campaignId: row.campaign_id,
      userId: row.user_id
    };
  }

  /**
   * Helper: Get reputation score deduction based on detection type
   */
  private getReputationDeduction(detectionType: string, confidenceScore: number): number {
    const baseDeductions = {
      'bot': 30,
      'suspicious': 15,
      'manual': 50
    };

    const baseDeduction = baseDeductions[detectionType] || 10;
    return Math.round(baseDeduction * confidenceScore);
  }

  /**
   * Helper: Get risk category based on reputation score
   */
  private getRiskCategory(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score < 25) return 'critical';
    if (score < 50) return 'high';
    if (score < 75) return 'medium';
    return 'low';
  }
}