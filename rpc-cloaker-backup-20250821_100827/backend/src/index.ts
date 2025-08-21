import 'dotenv/config';
import Fastify from 'fastify';
import { initializePlugins } from './plugins';
import { initializeRoutes } from './routes';
import { logger as pinoLogger } from './utils/logger';
import { config } from './config';
import { initializeDatabase } from './database';
import { initializeRedis } from './services/redis.service';
import { initializeWorkers } from './workers';

const server = Fastify({
  logger: { level: (pinoLogger as any).level || 'info' },
  trustProxy: true,
});

async function start() {
  try {
    // Initialize database connections
    await initializeDatabase();
    pinoLogger.info('Database initialized successfully');

    // Initialize Redis
    await initializeRedis();
    pinoLogger.info('Redis initialized successfully');

    // Register plugins
    await initializePlugins(server);
    pinoLogger.info('Plugins registered successfully');

    // Register routes
    await initializeRoutes(server);
    pinoLogger.info('Routes registered successfully');

    // Initialize background workers
    await initializeWorkers();
    pinoLogger.info('Workers initialized successfully');

    // Start server
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    pinoLogger.info(`Server listening on ${config.server.host}:${config.server.port}`);
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