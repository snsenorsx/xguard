import 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
    authorize: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
    rateLimit: (options?: { max?: number; timeWindow?: number; keyGenerator?: (request: FastifyRequest) => string; }) => (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}

