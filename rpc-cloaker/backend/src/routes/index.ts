import { FastifyInstance } from 'fastify';

export async function initializeRoutes(server: FastifyInstance) {
  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes
  await server.register(import('./routes.auth'), { prefix: '/api/auth' });
  await server.register(import('./routes.campaigns'), { prefix: '/api/campaigns' });
  await server.register(import('./routes.analytics'), { prefix: '/api/analytics' });
  await server.register(import('./routes.cloaker'), { prefix: '/api/cloaker' });
  await server.register(import('./routes.users'), { prefix: '/api/users' });
  
  // WebSocket routes
  await server.register(import('./routes.ws'), { prefix: '/ws' });
  
  // Public cloaking endpoint (no prefix)
  await server.register(import('./routes.public'));
}