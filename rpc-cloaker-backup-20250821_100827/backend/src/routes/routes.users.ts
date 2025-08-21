import { FastifyInstance } from 'fastify';
import { getDb } from '../database';

export default async function usersRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate as any);

  server.get('/me', async (request, reply) => {
    const db = getDb();
    const result = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [(request as any).user.id]);
    if (result.rows.length === 0) return reply.code(404).send({ error: 'Not found' });
    return { user: result.rows[0] };
  });

  server.patch('/me', {
  }, async (request, reply) => {
    const body = request.body as any;
    const db = getDb();
    if (!body.name) return reply.send({});
    const result = await db.query('UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role', [body.name, (request as any).user.id]);
    return { user: result.rows[0] };
  });
}

