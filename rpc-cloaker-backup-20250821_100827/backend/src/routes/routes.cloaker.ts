import { FastifyInstance } from 'fastify';
import { CloakerService } from '../services/cloaker.service';

export default async function cloakerRoutes(server: FastifyInstance) {
  // Process cloaker decision for a campaign by slug
  server.get('/:slug', async (request, reply) => {
    const { slug } = request.params as any;
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
  });
}

