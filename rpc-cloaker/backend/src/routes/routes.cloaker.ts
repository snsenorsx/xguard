import { FastifyInstance } from 'fastify';
import { CloakerService } from '../services/cloaker.service';

export default async function cloakerRoutes(server: FastifyInstance) {
  // Helper function to process request and send response
  async function handleCloakerRequest(request: any, reply: any) {
    const { slug } = request.params;
    const decision = await CloakerService.processRequest(request, slug);

    // Apply redirect based on type
    switch (decision.redirectType) {
      case '301':
        reply.code(301).header('Location', decision.redirectUrl).send();
        return;
      case '302':
      case 'direct':
        reply.code(302).header('Location', decision.redirectUrl).send();
        return;
      case 'js':
        reply.type('text/html').send(`<script>window.location.href='${decision.redirectUrl}'</script>`);
        return;
      case 'meta':
        reply.type('text/html').send(`<html><head><meta http-equiv="refresh" content="0;url=${decision.redirectUrl}" /></head></html>`);
        return;
      default:
        reply.code(302).header('Location', decision.redirectUrl).send();
        return;
    }
  }

  // GET request for standard cloaking
  server.get('/:slug', handleCloakerRequest);

  // POST request for advanced fingerprinting
  server.post('/:slug', {
    schema: {
      body: {
        type: 'object',
        properties: {
          fingerprint: {
            type: 'object',
            properties: {
              canvas: { type: 'object' },
              webgl: { type: 'object' },
              audio: { type: 'object' },
              screen: { type: 'object' },
              device: { type: 'object' },
              environment: { type: 'object' }
            }
          }
        }
      }
    }
  }, handleCloakerRequest);

  // OPTIONS for CORS preflight
  server.options('/:slug', async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .send();
  });
}

