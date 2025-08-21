import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(async function (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Log error
    logger.error({
      err: error,
      request: {
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        headers: request.headers,
      },
    });

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation error',
        details: error.errors,
      });
    }

    // Handle known HTTP errors
    if (error.statusCode) {
      return reply.code(error.statusCode).send({
        error: error.message,
      });
    }

    // Default to 500 Internal Server Error
    return reply.code(500).send({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
    });
  });

  // Handle uncaught errors
  fastify.setNotFoundHandler(async function (
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    return reply.code(404).send({
      error: 'Not found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });
}

export default fp(errorHandlerPlugin);