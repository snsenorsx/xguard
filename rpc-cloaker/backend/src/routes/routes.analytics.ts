import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getTimescaleDb } from '../database';

export default async function analyticsRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate as any);

  // Overview
  server.get('/overview', {
    schema: {
      querystring: z.object({
        from: z.string(),
        to: z.string(),
        campaignId: z.string().uuid().optional(),
      }) as any,
    },
  }, async (request, reply) => {
    const { from, to, campaignId } = request.query as any;
    const tsDb = getTimescaleDb();

    const whereCampaign = campaignId ? 'AND campaign_id = $3' : '';
    const params: any[] = [from, to];
    if (campaignId) params.push(campaignId);

    const totals = await tsDb.query(
      `SELECT 
        COUNT(*) FILTER (WHERE metric_type = 'page_view') as total,
        COUNT(*) FILTER (WHERE metric_type = 'page_view' AND (tags->>'is_bot') = 'true') as bots,
        COUNT(*) FILTER (WHERE metric_type = 'page_view' AND (tags->>'is_bot') = 'false') as humans,
        AVG((tags->>'response_time_ms')::float) as avg_resp
       FROM metrics
       WHERE time BETWEEN $1 AND $2 ${whereCampaign}`,
      params
    );

    const topCountries = await tsDb.query(
      `SELECT (tags->>'country') as country, COUNT(*) as count
       FROM metrics
       WHERE metric_type = 'page_view' AND time BETWEEN $1 AND $2 ${whereCampaign}
       GROUP BY (tags->>'country')
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    const topDevices = await tsDb.query(
      `SELECT (tags->>'device') as device, COUNT(*) as count
       FROM metrics
       WHERE metric_type = 'page_view' AND time BETWEEN $1 AND $2 ${whereCampaign}
       GROUP BY (tags->>'device')
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    const topBrowsers = await tsDb.query(
      `SELECT (tags->>'browser') as browser, COUNT(*) as count
       FROM metrics
       WHERE metric_type = 'page_view' AND time BETWEEN $1 AND $2 ${whereCampaign}
       GROUP BY (tags->>'browser')
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    const totalVisits = parseInt(totals.rows[0]?.total || '0', 10);
    const totalBots = parseInt(totals.rows[0]?.bots || '0', 10);
    const totalHumans = parseInt(totals.rows[0]?.humans || '0', 10);
    const avgResponseTime = parseFloat(totals.rows[0]?.avg_resp || '0');
    const botRate = totalVisits > 0 ? (totalBots / totalVisits) * 100 : 0;

    // Unique visitors from traffic_logs if available in main DB; fallback to approx by visitor fingerprint in tags
    // For now, set to humans count as a placeholder
    return {
      totalVisits,
      totalBots,
      totalHumans,
      botRate,
      avgResponseTime,
      uniqueVisitors: totalHumans,
      topCountries: topCountries.rows.map(r => ({ country: r.country || 'Unknown', count: parseInt(r.count, 10) })),
      topDevices: topDevices.rows.map(r => ({ device: r.device || 'Unknown', count: parseInt(r.count, 10) })),
      topBrowsers: topBrowsers.rows.map(r => ({ browser: r.browser || 'Unknown', count: parseInt(r.count, 10) })),
    };
  });

  // Time series
  server.get('/timeseries', {
    schema: {
      querystring: z.object({
        from: z.string(),
        to: z.string(),
        metric: z.string(),
        interval: z.enum(['1m', '1h', '1d']),
        campaignId: z.string().uuid().optional(),
      }) as any,
    },
  }, async (request, reply) => {
    const { from, to, metric, interval, campaignId } = request.query as any;
    const tsDb = getTimescaleDb();
    const whereCampaign = campaignId ? 'AND campaign_id = $3' : '';
    const params: any[] = [from, to];
    if (campaignId) params.push(campaignId);

    const metricFilter = metric === 'requests' ? "metric_type = 'page_view'" : "metric_type = 'page_view'";
    const bucket = interval === '1m' ? "1 minute" : interval === '1h' ? "1 hour" : "1 day";
    const result = await tsDb.query(
      `SELECT time_bucket(interval '${bucket}', time) as time, COUNT(*) as value
       FROM metrics
       WHERE ${metricFilter} AND time BETWEEN $1 AND $2 ${whereCampaign}
       GROUP BY time
       ORDER BY time ASC`,
      params
    );
    return result.rows.map(r => ({ time: r.time, value: parseInt(r.value, 10) }));
  });

  // Campaign stats summary
  server.get('/campaigns', {
    schema: {
      querystring: z.object({
        from: z.string(),
        to: z.string(),
      }) as any,
    },
  }, async (request, reply) => {
    const { from, to } = request.query as any;
    const tsDb = getTimescaleDb();
    const result = await tsDb.query(
      `SELECT campaign_id as "campaignId",
              COUNT(*) FILTER (WHERE metric_type = 'page_view') as "totalRequests",
              COUNT(*) FILTER (WHERE metric_type = 'page_view' AND (tags->>'is_bot') = 'true') as "botRequests",
              COUNT(*) FILTER (WHERE metric_type = 'page_view' AND (tags->>'is_bot') = 'false') as "humanRequests",
              COUNT(*) FILTER (WHERE (tags->>'page_shown') = 'money') as "moneyPageShown",
              COUNT(*) FILTER (WHERE (tags->>'page_shown') = 'safe') as "safePageShown",
              AVG((tags->>'response_time_ms')::float) as "avgResponseTime"
       FROM metrics
       WHERE time BETWEEN $1 AND $2
       GROUP BY campaign_id
       ORDER BY "totalRequests" DESC
      `,
      [from, to]
    );
    return result.rows.map(r => ({
      ...r,
      totalRequests: parseInt(r.totalRequests, 10),
      botRequests: parseInt(r.botRequests, 10),
      humanRequests: parseInt(r.humanRequests, 10),
      moneyPageShown: parseInt(r.moneyPageShown, 10),
      safePageShown: parseInt(r.safePageShown, 10),
      avgResponseTime: parseFloat(r.avgResponseTime),
      conversionRate: 0,
      campaignName: r.campaignId,
    }));
  });

  // Realtime simple stats
  server.get('/realtime', async (request, reply) => {
    const tsDb = getTimescaleDb();
    const result = await tsDb.query(
      `SELECT COUNT(*) as value FROM metrics WHERE metric_type = 'page_view' AND time >= NOW() - INTERVAL '1 minute'`
    );
    return { requestsLastMinute: parseInt(result.rows[0]?.value || '0', 10) };
  });

  // Export data
  server.get('/export', {
    schema: {
      querystring: z.object({
        from: z.string(),
        to: z.string(),
        format: z.enum(['csv', 'json']),
        campaignId: z.string().uuid().optional(),
      }) as any,
    },
  }, async (request, reply) => {
    const { from, to, format, campaignId } = request.query as any;
    const tsDb = getTimescaleDb();
    const whereCampaign = campaignId ? 'AND campaign_id = $3' : '';
    const params: any[] = [from, to];
    if (campaignId) params.push(campaignId);

    const res = await tsDb.query(
      `SELECT time, campaign_id, stream_id, metric_type, value, tags
       FROM metrics WHERE time BETWEEN $1 AND $2 ${whereCampaign} ORDER BY time ASC`,
      params
    );

    if (format === 'json') {
      reply.header('Content-Type', 'application/json');
      return res.rows;
    } else {
      reply.header('Content-Type', 'text/csv');
      const header = 'time,campaign_id,stream_id,metric_type,value,tags\n';
      const body = res.rows.map(r => (
        `${new Date(r.time).toISOString()},${r.campaign_id || ''},${r.stream_id || ''},${r.metric_type},${r.value},"${JSON.stringify(r.tags).replace(/"/g, '""')}"`
      )).join('\n');
      return header + body;
    }
  });
}

