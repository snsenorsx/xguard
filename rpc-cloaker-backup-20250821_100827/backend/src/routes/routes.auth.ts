import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { getDb } from '../database';
// import { logger } from '../utils/logger';

export default async function authRoutes(server: FastifyInstance) {
  // Register
  server.post('/register', async (request, reply) => {
    const body = request.body as any;
    const db = getDb();

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rows.length > 0) {
      return reply.code(400).send({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, name, role`,
      [body.email, passwordHash, body.name]
    );

    const user = result.rows[0];
    const token = server.jwt.sign({ id: user.id, email: user.email, role: user.role });
    const refreshToken = server.jwt.sign({ id: user.id, type: 'refresh' }, { expiresIn: '30d' });

    return reply.send({ user, token, refreshToken });
  });

  // Login
  server.post('/login', async (request, reply) => {
    const body = request.body as any;
    const db = getDb();

    const result = await db.query(
      'SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = $1',
      [body.email]
    );
    if (result.rows.length === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return reply.code(403).send({ error: 'Account disabled' });
    }
    const match = await bcrypt.compare(body.password, user.password_hash);
    if (!match) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = server.jwt.sign({ id: user.id, email: user.email, role: user.role });
    const refreshToken = server.jwt.sign({ id: user.id, type: 'refresh' }, { expiresIn: '30d' });
    return reply.send({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token, refreshToken });
  });

  // Me
  server.get('/me', { preHandler: [server.authenticate as any] }, async (request, reply) => {
    const userId = (request as any).user.id as string;
    const db = getDb();
    const result = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.send({ user: result.rows[0] });
  });

  // Refresh
  server.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as any;
    try {
      const payload = server.jwt.verify(refreshToken) as any;
      if (payload.type !== 'refresh') throw new Error('Invalid token');
      const token = server.jwt.sign({ id: payload.id, email: payload.email, role: payload.role });
      return reply.send({ token });
    } catch (e) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  // Logout (stateless JWT)
  server.post('/logout', { preHandler: [server.authenticate as any] }, async (request, reply) => {
    return reply.send({ status: 'ok' });
  });
}

