import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { CacheService } from '../services/redis.service';
import { config } from '../config';

interface RateLimitOptions {
  max?: number;
  timeWindow?: number;
  keyGenerator?: (request: FastifyRequest) => string;
}

async function rateLimitPlugin(fastify: FastifyInstance) {
  fastify.decorate('rateLimit', function (options: RateLimitOptions = {}) {
    const max = options.max || config.rateLimit.max;
    const timeWindow = options.timeWindow || config.rateLimit.timeWindow;
    const keyGenerator = options.keyGenerator || ((req: FastifyRequest) => {
      const userId = (req as any).currentUser?.id || 'anonymous';
      return `${req.ip}:${userId}`;
    });

    return async function (
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      const key = keyGenerator(request);
      const result = await CacheService.rateLimit(key, max, timeWindow / 1000);

      reply.header('X-RateLimit-Limit', max);
      reply.header('X-RateLimit-Remaining', result.remaining);
      reply.header('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

      if (!result.allowed) {
        return reply.code(429).send({
          error: 'Too many requests',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        });
      }
    };
  });
}

export default fp(rateLimitPlugin);