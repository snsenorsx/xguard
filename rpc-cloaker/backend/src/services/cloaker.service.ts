import { FastifyRequest } from 'fastify';
import UAParser from 'ua-parser-js';
import geoip from 'geoip-lite';
import { createHash } from 'crypto';
import { getDb, getTimescaleDb } from '../database';
import { CacheService } from './redis.service';
import { BotDetectionService } from './botDetection.service';
import { BlacklistService } from './blacklist.service';
import { getThreatIntelligenceService } from './threatIntelligence.service';
import { logger } from '../utils/logger';

export interface CloakingDecision {
  decision: 'money' | 'safe';
  reason: string;
  campaignId: string;
  streamId?: string;
  redirectUrl: string;
  redirectType: '301' | '302' | 'js' | 'meta' | 'direct';
  botScore?: number;
  processingTime: number;
}

export interface VisitorInfo {
  ip: string;
  userAgent: string;
  referer?: string;
  headers: Record<string, string>;
  fingerprintHash?: string;
  
  // Enhanced fingerprinting data
  advancedFingerprint?: {
    canvas?: {
      hash: string;
      geometry: string;
      text: string;
    };
    webgl?: {
      vendor: string;
      renderer: string;
      version: string;
      hash: string;
      extensions: string[];
    };
    audio?: {
      contextHash: string;
      compressorHash: string;
      oscillatorHash: string;
      sampleRate: number;
    };
    screen?: {
      resolution: string;
      colorDepth: number;
      pixelRatio: number;
      orientation: string;
    };
    device?: {
      hardwareConcurrency: number;
      maxTouchPoints: number;
      deviceMemory?: number;
      connection?: {
        effectiveType: string;
        downlink: number;
        rtt: number;
      };
    };
    environment?: {
      timezone: string;
      timezoneOffset: number;
      languages: string[];
      platform: string;
      cookieEnabled: boolean;
      plugins: Array<{
        name: string;
        description: string;
        filename: string;
      }>;
    };
    headlessDetection?: {
      confidence: number;
      indicators: string[];
      browserEngine: string;
      automationFramework?: string;
    };
  };
  
  geo?: {
    country: string;
    region: string;
    city: string;
    ll: [number, number];
  };
  device?: {
    type: string;
    vendor?: string;
    model?: string;
  };
  browser?: {
    name: string;
    version: string;
  };
  os?: {
    name: string;
    version: string;
  };
}

export class CloakerService {
  private static botDetection = new BotDetectionService();

  static async processRequest(
    request: FastifyRequest,
    campaignSlug: string
  ): Promise<CloakingDecision> {
    const startTime = Date.now();
    
    try {
      // Extract visitor information
      const visitorInfo = await this.extractVisitorInfo(request);
      
      // Check IP blacklist with threat intelligence
      const blacklistService = new BlacklistService(getDb(), null as any, new CacheService());
      const isBlacklisted = await blacklistService.isBlacklisted(visitorInfo.ip);
      
      if (isBlacklisted) {
        return {
          decision: 'safe',
          reason: 'IP blacklisted',
          campaignId: campaignSlug,
          redirectUrl: '/404',
          redirectType: '302',
          processingTime: Date.now() - startTime,
        };
      }
      
      // Get campaign information
      const campaign = await this.getCampaign(campaignSlug);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check cache first
      const cacheKey = `decision:${campaign.id}:${visitorInfo.fingerprintHash}`;
      const cachedDecision = await CacheService.get<CloakingDecision>(cacheKey);
      if (cachedDecision) {
        return {
          ...cachedDecision,
          processingTime: Date.now() - startTime,
        };
      }

      // Bot detection
      const botResult = await this.botDetection.detect(visitorInfo);
      
      // Apply targeting rules
      const stream = await this.selectStream(campaign.id, visitorInfo);
      
      // Make decision
      const decision: CloakingDecision = {
        decision: botResult.isBot ? 'safe' : 'money',
        reason: botResult.isBot ? `Bot detected: ${botResult.reason}` : 'Human visitor',
        campaignId: campaign.id,
        streamId: stream?.id,
        redirectUrl: botResult.isBot 
          ? (stream?.safe_page_override || campaign.safe_page_url)
          : (stream?.money_page_override || campaign.money_page_url),
        redirectType: campaign.redirect_type,
        botScore: botResult.score,
        processingTime: Date.now() - startTime,
      };

      // Cache decision
      await CacheService.set(cacheKey, decision, 300); // 5 minutes

      // Log traffic asynchronously
      this.logTraffic(visitorInfo, decision, botResult).catch(err => {
        logger.error('Failed to log traffic:', err);
      });

      return decision;
    } catch (error) {
      logger.error('Cloaking error:', error);
      
      // Fallback to safe page on error
      return {
        decision: 'safe',
        reason: 'Processing error',
        campaignId: campaignSlug,
        redirectUrl: '/404',
        redirectType: '302',
        processingTime: Date.now() - startTime,
      };
    }
  }

  private static async extractVisitorInfo(request: FastifyRequest): Promise<VisitorInfo> {
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || '';
    const referer = request.headers['referer'];
    
    // Parse user agent
    const uaParser = new UAParser(userAgent);
    const uaResult = uaParser.getResult();
    
    // Get geolocation
    const geo = geoip.lookup(ip);
    
    // Extract advanced fingerprint from request body (if POST)
    let advancedFingerprint;
    if (request.method === 'POST' && request.body) {
      const body = request.body as any;
      if (body.fingerprint) {
        advancedFingerprint = body.fingerprint;
      }
    }
    
    // Generate enhanced fingerprint hash
    const basicFingerprintData = [
      ip,
      userAgent,
      request.headers['accept-language'],
      request.headers['accept-encoding'],
      request.headers['accept'],
    ].join('|');
    
    // Include advanced fingerprint data if available
    let fingerprintData = basicFingerprintData;
    if (advancedFingerprint) {
      const advancedData = [
        advancedFingerprint.canvas?.hash || '',
        advancedFingerprint.webgl?.hash || '',
        advancedFingerprint.audio?.contextHash || '',
        advancedFingerprint.screen?.resolution || '',
        advancedFingerprint.device?.hardwareConcurrency?.toString() || '',
      ].join('|');
      fingerprintData = `${basicFingerprintData}::${advancedData}`;
    }
    
    const fingerprintHash = createHash('md5').update(fingerprintData).digest('hex');
    
    // Extract relevant headers (expanded for bot detection)
    const headers: Record<string, string> = {};
    const relevantHeaders = [
      'accept', 'accept-language', 'accept-encoding',
      'dnt', 'connection', 'upgrade-insecure-requests',
      'x-forwarded-for', 'x-real-ip', 'via', 'forwarded',
      'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
      'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
      'cache-control', 'pragma', 'authorization'
    ];
    for (const header of relevantHeaders) {
      if (request.headers[header]) {
        headers[header] = request.headers[header] as string;
      }
    }
    
    return {
      ip,
      userAgent,
      referer,
      headers,
      fingerprintHash,
      advancedFingerprint,
      geo: geo ? {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        ll: geo.ll,
      } : undefined,
      device: uaResult.device.type ? {
        type: uaResult.device.type,
        vendor: uaResult.device.vendor,
        model: uaResult.device.model,
      } : { type: 'desktop' },
      browser: uaResult.browser.name ? {
        name: uaResult.browser.name,
        version: uaResult.browser.version || '',
      } : undefined,
      os: uaResult.os.name ? {
        name: uaResult.os.name,
        version: uaResult.os.version || '',
      } : undefined,
    };
  }

  private static async getCampaign(slug: string) {
    // Try cache first
    const cacheKey = `campaign:${slug}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;
    
    const db = getDb();
    const result = await db.query(
      `SELECT id, name, status, money_page_url, safe_page_url, redirect_type
       FROM campaigns
       WHERE name = $1 AND status = 'active'
       LIMIT 1`,
      [slug]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const campaign = result.rows[0];
    await CacheService.set(cacheKey, campaign, 60); // Cache for 1 minute
    
    return campaign;
  }

  private static async selectStream(campaignId: string, visitorInfo: VisitorInfo) {
    const db = getDb();
    
    // Get active streams with their rules
    const streams = await db.query(
      `SELECT s.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', tr.id,
              'rule_type', tr.rule_type,
              'operator', tr.operator,
              'value', tr.value,
              'is_include', tr.is_include
            )
          ) FILTER (WHERE tr.id IS NOT NULL), 
          '[]'::json
        ) as rules
       FROM streams s
       LEFT JOIN targeting_rules tr ON tr.stream_id = s.id
       WHERE s.campaign_id = $1 AND s.is_active = true
       GROUP BY s.id
       ORDER BY s.weight DESC`,
      [campaignId]
    );
    
    // Filter streams based on targeting rules
    const eligibleStreams = streams.rows.filter(stream => {
      return this.matchesTargetingRules(stream.rules, visitorInfo);
    });
    
    if (eligibleStreams.length === 0) {
      return null;
    }
    
    // Select stream based on weight
    return this.selectByWeight(eligibleStreams);
  }

  private static matchesTargetingRules(rules: any[], visitorInfo: VisitorInfo): boolean {
    if (!rules || rules.length === 0) {
      return true;
    }
    
    for (const rule of rules) {
      const matches = this.evaluateRule(rule, visitorInfo);
      
      // If it's an exclude rule and matches, reject
      if (!rule.is_include && matches) {
        return false;
      }
      
      // If it's an include rule and doesn't match, reject
      if (rule.is_include && !matches) {
        return false;
      }
    }
    
    return true;
  }

  private static evaluateRule(rule: any, visitorInfo: VisitorInfo): boolean {
    switch (rule.rule_type) {
      case 'country':
        return this.evaluateOperator(
          visitorInfo.geo?.country,
          rule.operator,
          rule.value
        );
      
      case 'device':
        return this.evaluateOperator(
          visitorInfo.device?.type,
          rule.operator,
          rule.value
        );
      
      case 'browser':
        return this.evaluateOperator(
          visitorInfo.browser?.name,
          rule.operator,
          rule.value
        );
      
      case 'os':
        return this.evaluateOperator(
          visitorInfo.os?.name,
          rule.operator,
          rule.value
        );
      
      case 'referer':
        return this.evaluateOperator(
          visitorInfo.referer,
          rule.operator,
          rule.value
        );
      
      default:
        return true;
    }
  }

  private static evaluateOperator(value: any, operator: string, targetValue: any): boolean {
    switch (operator) {
      case 'equals':
        return value === targetValue;
      
      case 'not_equals':
        return value !== targetValue;
      
      case 'contains':
        return value && value.includes(targetValue);
      
      case 'not_contains':
        return !value || !value.includes(targetValue);
      
      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(value);
      
      case 'not_in':
        return !Array.isArray(targetValue) || !targetValue.includes(value);
      
      case 'regex':
        return value && new RegExp(targetValue).test(value);
      
      default:
        return true;
    }
  }

  private static selectByWeight(streams: any[]): any {
    const totalWeight = streams.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const stream of streams) {
      random -= stream.weight;
      if (random <= 0) {
        return stream;
      }
    }
    
    return streams[0];
  }

  private static async logTraffic(
    visitorInfo: VisitorInfo,
    decision: CloakingDecision,
    botResult: any
  ) {
    const db = getDb();
    const tsDb = getTimescaleDb();
    
    // Log to main database
    await db.query(
      `INSERT INTO traffic_logs (
        campaign_id, stream_id, visitor_id, ip_address, user_agent,
        referer, country_code, city, device_type, browser, os,
        is_bot, bot_score, decision, page_shown, response_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        decision.campaignId,
        decision.streamId,
        visitorInfo.fingerprintHash,
        visitorInfo.ip,
        visitorInfo.userAgent,
        visitorInfo.referer,
        visitorInfo.geo?.country,
        visitorInfo.geo?.city,
        visitorInfo.device?.type,
        visitorInfo.browser?.name,
        visitorInfo.os?.name,
        botResult.isBot,
        botResult.score,
        decision.decision,
        decision.decision,
        decision.processingTime,
      ]
    );
    
    // Log metrics to TimescaleDB
    await tsDb.query(
      `INSERT INTO metrics (time, campaign_id, stream_id, metric_type, value, tags)
       VALUES (NOW(), $1, $2, $3, $4, $5)`,
      [
        decision.campaignId,
        decision.streamId,
        'page_view',
        1,
        {
          is_bot: botResult.isBot.toString(),
          page_shown: decision.decision,
          country: visitorInfo.geo?.country,
          device: visitorInfo.device?.type,
          browser: visitorInfo.browser?.name,
          response_time_ms: decision.processingTime.toString(),
        },
      ]
    );
  }
}