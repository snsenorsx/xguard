import { FastifyInstance } from 'fastify';

export default async function wsRoutes(server: FastifyInstance) {
  server.get('/realtime', { websocket: true }, (connection, req) => {
    const interval = setInterval(() => {
      try {
        connection.socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      } catch {}
    }, 30000);

    connection.socket.on('close', () => {
      clearInterval(interval);
    });
  });
}

