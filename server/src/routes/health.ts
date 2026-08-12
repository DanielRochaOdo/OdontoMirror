import type { FastifyInstance } from 'fastify';
export async function healthRoutes(app: FastifyInstance) { app.get('/health', async () => ({ ok: true, service: 'odonto-mirror-api', readOnly: true, timestamp: new Date().toISOString() })); }
