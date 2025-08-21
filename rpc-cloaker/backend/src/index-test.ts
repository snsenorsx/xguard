import 'dotenv/config';
import Fastify from 'fastify';
import { initializePlugins } from './plugins';
import { initializeRoutes } from './routes';
import { logger as pinoLogger } from './utils/logger';
import { config } from './config';

const server = Fastify({
  logger: { level: (pinoLogger as any).level || 'info' },
  trustProxy: true,
});

async function start() {
  try {
    pinoLogger.info('Starting server without database/redis for testing...');
    
    // Register plugins
    await initializePlugins(server);
    pinoLogger.info('Plugins registered successfully');

    // Register routes
    await initializeRoutes(server);
    pinoLogger.info('Routes registered successfully');

    // Start server
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    pinoLogger.info(`Server listening on ${config.server.host}:${config.server.port}`);
    pinoLogger.info('Test the following endpoints:');
    pinoLogger.info('- GET http://localhost:3000/health');
    pinoLogger.info('- POST http://localhost:3000/api/detect');
    pinoLogger.info('- GET http://localhost:3000/api/blacklist');
  } catch (err) {
    pinoLogger.error(err as any);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async () => {
  pinoLogger.info('Received shutdown signal');
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();