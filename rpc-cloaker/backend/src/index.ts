import 'dotenv/config';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { initializePlugins } from './plugins';
import { initializeRoutes } from './routes';
import { logger } from './utils/logger';
import { config } from './config';
import { initializeDatabase } from './database';
import { initializeRedis } from './services/redis.service';
import { initializeWorkers } from './workers';

const server = Fastify({
  logger: logger,
  trustProxy: true,
}).withTypeProvider<TypeBoxTypeProvider>();

async function start() {
  try {
    // Initialize database connections
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis initialized successfully');

    // Register plugins
    await initializePlugins(server);
    logger.info('Plugins registered successfully');

    // Register routes
    await initializeRoutes(server);
    logger.info('Routes registered successfully');

    // Initialize background workers
    await initializeWorkers();
    logger.info('Workers initialized successfully');

    // Start server
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`Server listening on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal');
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();