import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { config } from '../config';

export async function initializePlugins(server: FastifyInstance) {
  // CORS
  await server.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  // JWT
  await server.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // Multipart/form-data support
  await server.register(multipart, {
    limits: {
      fileSize: config.upload.maxFileSize,
    },
  });

  // WebSocket support
  await server.register(websocket);

  // API Documentation (development only)
  if (config.isDevelopment) {
    await server.register(swagger, {
      openapi: {
        info: {
          title: 'RPC Cloaker API',
          description: 'Advanced cloaking system API documentation',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${config.server.port}`,
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    });

    await server.register(swaggerUI, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }

  // Custom plugins
  await server.register(import('./auth'));
  await server.register(import('./rateLimit'));
  await server.register(import('./errorHandler'));
}