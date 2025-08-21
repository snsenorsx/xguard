import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { getDb } from '../database';

interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.code(401).send({ error: 'Missing authentication token' });
      }

      const decoded = await request.jwtVerify<JWTPayload>();
      
      // Verify user still exists and is active
      const db = getDb();
      const result = await db.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        return reply.code(401).send({ error: 'Invalid authentication' });
      }

      request.user = {
        id: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
      };
    } catch (err) {
      return reply.code(401).send({ error: 'Invalid authentication token' });
    }
  });

  fastify.decorate('authorize', function (roles: string[]) {
    return async function (
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      if (!request.user) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      if (!roles.includes(request.user.role)) {
        return reply.code(403).send({ error: 'Insufficient permissions' });
      }
    };
  });
}

export default fp(authPlugin);