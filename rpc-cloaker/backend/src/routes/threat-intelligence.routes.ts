/**
 * Threat Intelligence API Routes
 * AbuseIPDB + VirusTotal integration endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getThreatIntelligenceService } from '../services/threatIntelligence.service';
import { getCacheService } from '../services/cache.service';

interface AnalyzeIPRequest {
  Body: {
    ipAddress: string;
  };
}

interface BulkAnalyzeRequest {
  Body: {
    ipAddresses: string[];
  };
}

interface ThreatIntelligenceQuery {
  ip?: string;
  limit?: number;
  page?: number;
}

export default async function threatIntelligenceRoutes(fastify: FastifyInstance) {
  const cacheService = getCacheService();
  const threatService = getThreatIntelligenceService();

  // Analyze single IP
  fastify.post<AnalyzeIPRequest>('/analyze', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['ipAddress'],
        properties: {
          ipAddress: { type: 'string', format: 'ipv4' }
        }
      }
    }
  }, async (request: FastifyRequest<AnalyzeIPRequest>, reply: FastifyReply) => {
    try {
      const { ipAddress } = request.body;
      
      const result = await threatService.analyzeIP(ipAddress);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Threat analysis error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to analyze IP address'
      });
    }
  });

  // Bulk analyze multiple IPs
  fastify.post<BulkAnalyzeRequest>('/analyze/bulk', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['ipAddresses'],
        properties: {
          ipAddresses: {
            type: 'array',
            items: { type: 'string', format: 'ipv4' },
            maxItems: 100 // Limit bulk requests
          }
        }
      }
    }
  }, async (request: FastifyRequest<BulkAnalyzeRequest>, reply: FastifyReply) => {
    try {
      const { ipAddresses } = request.body;
      
      if (ipAddresses.length > 100) {
        return reply.status(400).send({
          success: false,
          error: 'Maximum 100 IP addresses allowed per bulk request'
        });
      }
      
      const results = await threatService.analyzeBulkIPs(ipAddresses);
      
      return reply.send({
        success: true,
        data: {
          results,
          total: results.length,
          maliciousCount: results.filter((r: any) => r.isMalicious).length
        }
      });
    } catch (error) {
      console.error('Bulk threat analysis error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to analyze IP addresses'
      });
    }
  });

  // Get threat intelligence statistics
  fastify.get('/stats', {
    preHandler: fastify.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await threatService.getStatistics();
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Threat intelligence stats error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  });

  // Clear threat intelligence cache
  fastify.delete('/cache', {
    preHandler: fastify.authenticate
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { ip } = request.query;
      
      await threatService.clearCache(ip);
      
      return reply.send({
        success: true,
        message: ip ? `Cache cleared for IP: ${ip}` : 'All threat intelligence cache cleared'
      });
    } catch (error) {
      console.error('Cache clear error:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to clear cache'
      });
    }
  });

  // Health check for threat intelligence services
  fastify.get('/health', {
    preHandler: fastify.authenticate
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await threatService.getStatistics();
      
      const health = {
        status: 'healthy',
        services: {
          abuseIPDB: {
            available: !!process.env.ABUSEIPDB_API_KEY,
            requestsRemaining: stats.rateLimits.abuseIPDB.remaining
          },
          virusTotal: {
            available: !!process.env.VIRUSTOTAL_API_KEY,
            requestsRemaining: stats.rateLimits.virusTotal.remaining
          }
        },
        cache: {
          namespace: stats.cache.namespace,
          ttl: stats.cache.ttl
        }
      };
      
      return reply.send({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Health check error:', error);
      return reply.status(503).send({
        success: false,
        error: 'Threat intelligence service unhealthy'
      });
    }
  });
}