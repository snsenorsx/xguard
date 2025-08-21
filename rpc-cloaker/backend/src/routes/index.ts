import { FastifyInstance } from 'fastify';

export async function initializeRoutes(server: FastifyInstance) {
  // Health check
  server.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes
  await server.register(import('./auth.routes'), { prefix: '/api/auth' });
  await server.register(import('./campaigns.routes'), { prefix: '/api/campaigns' });
  await server.register(import('./analytics.routes'), { prefix: '/api/analytics' });
  await server.register(import('./cloaker.routes'), { prefix: '/api/cloaker' });
  await server.register(import('./users.routes'), { prefix: '/api/users' });
  
  // WebSocket routes
  await server.register(import('./ws.routes'), { prefix: '/ws' });
  
  // Public cloaking endpoint (no prefix)
  await server.register(import('./public.routes'));
}