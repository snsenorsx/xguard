import { FastifyInstance } from 'fastify';
import { BotDetectionService } from '../services/bot-detection.service';
import { BlacklistService } from '../services/blacklist.service';
import { ThreatIntelligenceService } from '../services/threat-intelligence.service';
import { FingerprintingService } from '../services/fingerprinting.service';
import { TrafficLogService } from '../services/traffic-log.service';

interface DetectRequestBody {
  url: string;
  headers: Record<string, string>;
  fingerprint?: {
    canvas?: any;
    webgl?: any;
    audio?: any;
    screen?: any;
    device?: any;
    environment?: any;
    ja3?: string;
    ja3s?: string;
  };
  campaignId?: string;
}

interface DetectResponse {
  decision: 'pass' | 'block';
  reason?: string;
  confidence: number;
  redirectUrl?: string;
  details?: {
    isBot: boolean;
    botConfidence: number;
    isThreat: boolean;
    threatScore: number;
    isBlacklisted: boolean;
    fingerprintScore: number;
    ja3Match?: boolean;
  };
}

export default async function detectRoutes(server: FastifyInstance) {
  server.post<{ Body: DetectRequestBody }>('/detect', {
    schema: {
      body: {
        type: 'object',
        required: ['url', 'headers'],
        properties: {
          url: { type: 'string' },
          headers: { type: 'object' },
          fingerprint: {
            type: 'object',
            properties: {
              canvas: { type: 'object' },
              webgl: { type: 'object' },
              audio: { type: 'object' },
              screen: { type: 'object' },
              device: { type: 'object' },
              environment: { type: 'object' },
              ja3: { type: 'string' },
              ja3s: { type: 'string' }
            }
          },
          campaignId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            decision: { type: 'string', enum: ['pass', 'block'] },
            reason: { type: 'string' },
            confidence: { type: 'number' },
            redirectUrl: { type: 'string' },
            details: {
              type: 'object',
              properties: {
                isBot: { type: 'boolean' },
                botConfidence: { type: 'number' },
                isThreat: { type: 'boolean' },
                threatScore: { type: 'number' },
                isBlacklisted: { type: 'boolean' },
                fingerprintScore: { type: 'number' },
                ja3Match: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { url, headers, fingerprint, campaignId } = request.body;
      
      // Extract IP address
      const ipAddress = request.ip || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown';
      
      // Create request context
      const requestContext = {
        url,
        headers,
        fingerprint,
        campaignId,
        ipAddress,
        userAgent: headers['user-agent'] || '',
        timestamp: new Date()
      };
      
      // Parallel detection checks
      const [
        botDetection,
        blacklistCheck,
        threatCheck,
        fingerprintAnalysis
      ] = await Promise.all([
        BotDetectionService.detect(requestContext),
        BlacklistService.checkIp(ipAddress),
        ThreatIntelligenceService.analyzeIp(ipAddress),
        fingerprint ? FingerprintingService.analyze(fingerprint) : Promise.resolve(null)
      ]);
      
      // Calculate overall decision
      let decision: 'pass' | 'block' = 'pass';
      let reason = '';
      let confidence = 0;
      
      // Check blacklist first (highest priority)
      if (blacklistCheck.isBlacklisted) {
        decision = 'block';
        reason = `Blacklisted: ${blacklistCheck.reason}`;
        confidence = 1.0;
      }
      // Check threat intelligence
      else if (threatCheck.isThreat && threatCheck.confidence > 0.75) {
        decision = 'block';
        reason = `Threat detected: ${threatCheck.reason}`;
        confidence = threatCheck.confidence;
      }
      // Check bot detection
      else if (botDetection.isBot && botDetection.confidence > 0.8) {
        decision = 'block';
        reason = `Bot detected: ${botDetection.type}`;
        confidence = botDetection.confidence;
      }
      // Check fingerprint anomalies
      else if (fingerprintAnalysis && fingerprintAnalysis.anomalyScore > 0.85) {
        decision = 'block';
        reason = 'Suspicious fingerprint';
        confidence = fingerprintAnalysis.anomalyScore;
      }
      
      // Log traffic
      await TrafficLogService.log({
        campaignId: campaignId || 'default',
        ipAddress,
        userAgent: requestContext.userAgent,
        decision,
        reason,
        confidence,
        fingerprint,
        headers,
        timestamp: new Date()
      });
      
      // Prepare response
      const response: DetectResponse = {
        decision,
        confidence,
        ...(reason && { reason }),
        ...(decision === 'pass' && { redirectUrl: url }),
        details: {
          isBot: botDetection.isBot,
          botConfidence: botDetection.confidence,
          isThreat: threatCheck.isThreat,
          threatScore: threatCheck.confidence,
          isBlacklisted: blacklistCheck.isBlacklisted,
          fingerprintScore: fingerprintAnalysis?.anomalyScore || 0,
          ...(fingerprint?.ja3 && { ja3Match: fingerprintAnalysis?.ja3Match })
        }
      };
      
      return response;
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: 'Detection service failed'
      });
    }
  });
  
  // Health check for detection service
  server.get('/detect/health', async () => {
    try {
      const [
        botHealth,
        blacklistHealth,
        threatHealth
      ] = await Promise.all([
        BotDetectionService.healthCheck(),
        BlacklistService.healthCheck(),
        ThreatIntelligenceService.healthCheck()
      ]);
      
      return {
        status: 'ok',
        services: {
          botDetection: botHealth,
          blacklist: blacklistHealth,
          threatIntelligence: threatHealth
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  });
}