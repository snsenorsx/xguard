import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../database';

export default async function campaignsRoutes(server: FastifyInstance) {
  const CreateSchema = z.object({
    name: z.string().min(2),
    moneyPageUrl: z.string().url(),
    safePageUrl: z.string().url(),
    redirectType: z.enum(['301', '302', 'js', 'meta', 'direct']),
    notes: z.string().optional(),
  });

  const UpdateSchema = CreateSchema.partial().extend({
    status: z.enum(['active', 'paused', 'completed']).optional(),
  });

  server.addHook('preHandler', server.authenticate as any);

  // List
  server.get('/', async (request, reply) => {
    const db = getDb();
    const result = await db.query(
      `SELECT id, name, status, money_page_url AS "moneyPageUrl", safe_page_url AS "safePageUrl",
              redirect_type AS "redirectType", notes, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM campaigns
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [(request as any).currentUser.id]
    );
    return result.rows;
  });

  // Get by id
  server.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const db = getDb();
    const result = await db.query(
      `SELECT id, name, status, money_page_url AS "moneyPageUrl", safe_page_url AS "safePageUrl",
              redirect_type AS "redirectType", notes, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM campaigns WHERE id = $1 AND user_id = $2`,
      [id, (request as any).currentUser.id]
    );
    if (result.rows.length === 0) return reply.code(404).send({ error: 'Not found' });
    return result.rows[0];
  });

  // Create
  server.post('/', { schema: { body: CreateSchema as any } }, async (request, reply) => {
    const body = CreateSchema.parse(request.body);
    const db = getDb();
    const result = await db.query(
      `INSERT INTO campaigns (user_id, name, money_page_url, safe_page_url, redirect_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, status, money_page_url AS "moneyPageUrl", safe_page_url AS "safePageUrl",
                 redirect_type AS "redirectType", notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        (request as any).user.id,
        body.name,
        body.moneyPageUrl,
        body.safePageUrl,
        body.redirectType,
        body.notes || null,
      ]
    );
    reply.code(201).send(result.rows[0]);
  });

  // Update
  server.patch('/:id', { schema: { body: UpdateSchema as any } }, async (request, reply) => {
    const body = UpdateSchema.parse(request.body);
    const { id } = request.params as any;
    const db = getDb();

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (body.name) { fields.push(`name = $${idx++}`); values.push(body.name); }
    if (body.moneyPageUrl) { fields.push(`money_page_url = $${idx++}`); values.push(body.moneyPageUrl); }
    if (body.safePageUrl) { fields.push(`safe_page_url = $${idx++}`); values.push(body.safePageUrl); }
    if (body.redirectType) { fields.push(`redirect_type = $${idx++}`); values.push(body.redirectType); }
    if (typeof body.notes !== 'undefined') { fields.push(`notes = $${idx++}`); values.push(body.notes); }
    if (body.status) { fields.push(`status = $${idx++}`); values.push(body.status); }

    if (fields.length === 0) return reply.send({});

    values.push(id);
    values.push((request as any).currentUser.id);

    const result = await db.query(
      `UPDATE campaigns SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING id, name, status, money_page_url AS "moneyPageUrl", safe_page_url AS "safePageUrl",
                 redirect_type AS "redirectType", notes, created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (result.rows.length === 0) return reply.code(404).send({ error: 'Not found' });
    return result.rows[0];
  });

  // Delete
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const db = getDb();
    await db.query('DELETE FROM campaigns WHERE id = $1 AND user_id = $2', [id, (request as any).user.id]);
    reply.code(204).send();
  });

  // Streams - list
  server.get('/:id/streams', async (request, reply) => {
    const { id } = request.params as any;
    const db = getDb();
    const res = await db.query(
      `SELECT id, campaign_id AS "campaignId", name, weight, is_active AS "isActive",
              money_page_override AS "moneyPageOverride", safe_page_override AS "safePageOverride",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM streams WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return res.rows;
  });

  // Streams - create
  server.post('/:id/streams', {
    schema: { body: z.object({
      name: z.string().min(2),
      weight: z.number().min(0).max(1000).default(100),
      isActive: z.boolean().default(true),
      moneyPageOverride: z.string().url().optional(),
      safePageOverride: z.string().url().optional(),
    }) as any },
  }, async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const db = getDb();
    const res = await db.query(
      `INSERT INTO streams (campaign_id, name, weight, is_active, money_page_override, safe_page_override)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, campaign_id AS "campaignId", name, weight, is_active AS "isActive",
                 money_page_override AS "moneyPageOverride", safe_page_override AS "safePageOverride",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, body.name, body.weight ?? 100, body.isActive ?? true, body.moneyPageOverride || null, body.safePageOverride || null]
    );
    reply.code(201).send(res.rows[0]);
  });

  // Streams - update
  server.patch('/:id/streams/:streamId', {
    schema: { body: z.object({
      name: z.string().min(2).optional(),
      weight: z.number().min(0).max(1000).optional(),
      isActive: z.boolean().optional(),
      moneyPageOverride: z.string().url().optional().nullable(),
      safePageOverride: z.string().url().optional().nullable(),
    }) as any },
  }, async (request, reply) => {
    const { id, streamId } = request.params as any;
    const body = request.body as any;
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (typeof body.name !== 'undefined') { fields.push(`name = $${idx++}`); values.push(body.name); }
    if (typeof body.weight !== 'undefined') { fields.push(`weight = $${idx++}`); values.push(body.weight); }
    if (typeof body.isActive !== 'undefined') { fields.push(`is_active = $${idx++}`); values.push(body.isActive); }
    if (typeof body.moneyPageOverride !== 'undefined') { fields.push(`money_page_override = $${idx++}`); values.push(body.moneyPageOverride); }
    if (typeof body.safePageOverride !== 'undefined') { fields.push(`safe_page_override = $${idx++}`); values.push(body.safePageOverride); }
    if (fields.length === 0) return reply.send({});
    values.push(streamId, id);
    const res = await db.query(
      `UPDATE streams SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx++} AND campaign_id = $${idx}
       RETURNING id, campaign_id AS "campaignId", name, weight, is_active AS "isActive",
                 money_page_override AS "moneyPageOverride", safe_page_override AS "safePageOverride",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );
    if (res.rows.length === 0) return reply.code(404).send({ error: 'Not found' });
    return res.rows[0];
  });

  // Streams - delete
  server.delete('/:id/streams/:streamId', async (request, reply) => {
    const { id, streamId } = request.params as any;
    const db = getDb();
    await db.query('DELETE FROM streams WHERE id = $1 AND campaign_id = $2', [streamId, id]);
    reply.code(204).send();
  });

  // Targeting Rules - list
  server.get('/:id/streams/:streamId/targeting', async (request, reply) => {
    const { id, streamId } = request.params as any;
    const db = getDb();
    const res = await db.query(
      `SELECT id, stream_id AS "streamId", rule_type AS "ruleType", operator, value, is_include AS "isInclude",
              created_at AS "createdAt"
       FROM targeting_rules WHERE stream_id = $1`,
      [streamId]
    );
    return res.rows;
  });

  // Targeting Rules - create
  server.post('/:id/streams/:streamId/targeting', {
    schema: { body: z.object({
      ruleType: z.string(),
      operator: z.string(),
      value: z.any(),
      isInclude: z.boolean().default(true),
    }) as any },
  }, async (request, reply) => {
    const { streamId } = request.params as any;
    const body = request.body as any;
    const db = getDb();
    const res = await db.query(
      `INSERT INTO targeting_rules (stream_id, rule_type, operator, value, is_include)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, stream_id AS "streamId", rule_type AS "ruleType", operator, value, is_include AS "isInclude",
                 created_at AS "createdAt"`,
      [streamId, body.ruleType, body.operator, JSON.stringify(body.value), body.isInclude]
    );
    reply.code(201).send(res.rows[0]);
  });

  // Targeting Rules - update
  server.patch('/:id/streams/:streamId/targeting/:ruleId', {
    schema: { body: z.object({
      ruleType: z.string().optional(),
      operator: z.string().optional(),
      value: z.any().optional(),
      isInclude: z.boolean().optional(),
    }) as any },
  }, async (request, reply) => {
    const { streamId, ruleId } = request.params as any;
    const body = request.body as any;
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (typeof body.ruleType !== 'undefined') { fields.push(`rule_type = $${idx++}`); values.push(body.ruleType); }
    if (typeof body.operator !== 'undefined') { fields.push(`operator = $${idx++}`); values.push(body.operator); }
    if (typeof body.value !== 'undefined') { fields.push(`value = $${idx++}`); values.push(JSON.stringify(body.value)); }
    if (typeof body.isInclude !== 'undefined') { fields.push(`is_include = $${idx++}`); values.push(body.isInclude); }
    if (fields.length === 0) return reply.send({});
    values.push(ruleId, streamId);
    const res = await db.query(
      `UPDATE targeting_rules SET ${fields.join(', ')}, created_at = created_at WHERE id = $${idx++} AND stream_id = $${idx}
       RETURNING id, stream_id AS "streamId", rule_type AS "ruleType", operator, value, is_include AS "isInclude",
                 created_at AS "createdAt"`,
      values
    );
    if (res.rows.length === 0) return reply.code(404).send({ error: 'Not found' });
    return res.rows[0];
  });

  // Targeting Rules - delete
  server.delete('/:id/streams/:streamId/targeting/:ruleId', async (request, reply) => {
    const { streamId, ruleId } = request.params as any;
    const db = getDb();
    await db.query('DELETE FROM targeting_rules WHERE id = $1 AND stream_id = $2', [ruleId, streamId]);
    reply.code(204).send();
  });
}

