import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BlacklistService } from '../services/blacklist.service';

export default async function blacklistRoutes(fastify: FastifyInstance) {
  const blacklistService = new BlacklistService(fastify.pg, fastify.redis);

  // Check if IP is blacklisted (public endpoint for quick checks)
  fastify.get('/blacklist/check/:ip', async (request: FastifyRequest<{
    Params: { ip: string }
  }>, reply: FastifyReply) => {
    try {
      const { ip } = request.params;
      
      // Validate IP format
      if (!isValidIP(ip)) {
        return reply.code(400).send({ error: 'Invalid IP address format' });
      }

      const isBlacklisted = await blacklistService.isBlacklisted(ip);
      
      reply.send({
        ip,
        isBlacklisted,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error('Error checking IP blacklist:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Add IP to blacklist
  fastify.post('/blacklist', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest<{
    Body: {
      ipAddress: string;
      reason: string;
      detectionType: 'bot' | 'suspicious' | 'manual';
      confidenceScore?: number;
      expiresAt?: string;
      isPermanent?: boolean;
      campaignId?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { ipAddress, reason, detectionType, confidenceScore, expiresAt, isPermanent, campaignId } = request.body;
      const userId = request.user.id;

      // Validate IP format
      if (!isValidIP(ipAddress)) {
        return reply.code(400).send({ error: 'Invalid IP address format' });
      }

      // Validate required fields
      if (!reason || !detectionType) {
        return reply.code(400).send({ error: 'Reason and detection type are required' });
      }

      const entry = await blacklistService.addToBlacklist({
        ipAddress,
        reason,
        detectionType,
        confidenceScore,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        isPermanent,
        campaignId,
        userId
      });

      reply.code(201).send(entry);
    } catch (error) {
      request.log.error('Error adding to blacklist:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Remove IP from blacklist
  fastify.delete('/blacklist/:ip', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest<{
    Params: { ip: string }
  }>, reply: FastifyReply) => {
    try {
      const { ip } = request.params;
      const userId = request.user.id;

      if (!isValidIP(ip)) {
        return reply.code(400).send({ error: 'Invalid IP address format' });
      }

      const removed = await blacklistService.removeFromBlacklist(ip, userId);
      
      if (removed) {
        reply.send({ message: 'IP removed from blacklist', ip });
      } else {
        reply.code(404).send({ error: 'IP not found in blacklist' });
      }
    } catch (error) {
      request.log.error('Error removing from blacklist:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get blacklisted IPs with filtering and pagination
  fastify.get('/blacklist', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      detectionType?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { page, limit, search, detectionType } = request.query;

      const result = await blacklistService.getBlacklistedIPs({
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        search,
        detectionType
      });

      reply.send(result);
    } catch (error) {
      request.log.error('Error getting blacklisted IPs:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get IP reputation
  fastify.get('/blacklist/reputation/:ip', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest<{
    Params: { ip: string }
  }>, reply: FastifyReply) => {
    try {
      const { ip } = request.params;

      if (!isValidIP(ip)) {
        return reply.code(400).send({ error: 'Invalid IP address format' });
      }

      const reputation = await blacklistService.getIPReputation(ip);
      
      if (reputation) {
        reply.send(reputation);
      } else {
        reply.code(404).send({ error: 'No reputation data found for this IP' });
      }
    } catch (error) {
      request.log.error('Error getting IP reputation:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get blacklist statistics
  fastify.get('/blacklist/stats', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await blacklistService.getStatistics();
      reply.send(stats);
    } catch (error) {
      request.log.error('Error getting blacklist statistics:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Clean expired entries (admin only)
  fastify.post('/blacklist/cleanup', {
    preHandler: [fastify.authenticate, fastify.requireAdmin]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deletedCount = await blacklistService.cleanExpiredEntries();
      reply.send({ 
        message: 'Cleanup completed', 
        deletedCount 
      });
    } catch (error) {
      request.log.error('Error during cleanup:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Bulk operations
  fastify.post('/blacklist/bulk', {
    preHandler: [fastify.authenticate]
  }, async (request: FastifyRequest<{
    Body: {
      action: 'add' | 'remove';
      ips: string[];
      reason?: string;
      detectionType?: 'bot' | 'suspicious' | 'manual';
      expiresAt?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      const { action, ips, reason, detectionType, expiresAt } = request.body;
      const userId = request.user.id;

      if (!Array.isArray(ips) || ips.length === 0) {
        return reply.code(400).send({ error: 'IPs array is required and cannot be empty' });
      }

      // Validate all IPs
      for (const ip of ips) {
        if (!isValidIP(ip)) {
          return reply.code(400).send({ error: `Invalid IP address format: ${ip}` });
        }
      }

      const results = [];

      if (action === 'add') {
        if (!reason || !detectionType) {
          return reply.code(400).send({ error: 'Reason and detection type are required for bulk add' });
        }

        for (const ip of ips) {
          try {
            const entry = await blacklistService.addToBlacklist({
              ipAddress: ip,
              reason,
              detectionType,
              expiresAt: expiresAt ? new Date(expiresAt) : undefined,
              userId
            });
            results.push({ ip, status: 'added', entry });
          } catch (error) {
            results.push({ ip, status: 'error', error: error.message });
          }
        }
      } else if (action === 'remove') {
        for (const ip of ips) {
          try {
            const removed = await blacklistService.removeFromBlacklist(ip, userId);
            results.push({ ip, status: removed ? 'removed' : 'not_found' });
          } catch (error) {
            results.push({ ip, status: 'error', error: error.message });
          }
        }
      } else {
        return reply.code(400).send({ error: 'Invalid action. Must be "add" or "remove"' });
      }

      reply.send({
        action,
        results,
        total: ips.length,
        successful: results.filter(r => r.status === 'added' || r.status === 'removed').length,
        failed: results.filter(r => r.status === 'error').length
      });
    } catch (error) {
      request.log.error('Error in bulk operation:', error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

// Helper function to validate IP address format
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}