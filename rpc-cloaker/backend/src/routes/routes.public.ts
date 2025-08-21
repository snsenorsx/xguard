import { FastifyInstance } from 'fastify';

export default async function publicRoutes(server: FastifyInstance) {
  server.get('/', async () => ({ ok: true }));
}

