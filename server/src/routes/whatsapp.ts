import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { WhatsAppSessionManager } from '../whatsapp/WhatsAppSessionManager.js';

const idSchema = z.object({ id: z.string().uuid() });
const accountSchema = z.object({ name: z.string().min(2).max(80), description: z.string().max(120).optional() });
export async function whatsappRoutes(app: FastifyInstance, options: { manager: WhatsAppSessionManager }) {
  const { manager } = options;
  app.post('/api/whatsapp/accounts', async (request, response) => { const parsed = accountSchema.safeParse(request.body); if (!parsed.success) return response.code(400).send({ error: 'invalid_account' }); const accountId = randomUUID(); await manager.create(accountId); return response.code(201).send({ accountId, name: parsed.data.name, description: parsed.data.description, status: 'qr_required' }); });
  app.post('/api/whatsapp/:id/connect', async (request, response) => { const parsed = idSchema.safeParse(request.params); if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' }); const status = await manager.create(parsed.data.id); return { accountId: parsed.data.id, status }; });
  app.post('/api/whatsapp/:id/disconnect', async (request, response) => { const parsed = idSchema.safeParse(request.params); if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' }); const status = await manager.disconnect(parsed.data.id); return { accountId: parsed.data.id, status }; });
  app.get('/api/whatsapp/:id/status', async (request, response) => { const parsed = idSchema.safeParse(request.params); if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' }); return { accountId: parsed.data.id, status: await manager.status(parsed.data.id) }; });
  app.get('/api/whatsapp/:id/qr', async (request, response) => { const parsed = idSchema.safeParse(request.params); if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' }); return { accountId: parsed.data.id, qrCode: await manager.qr(parsed.data.id) }; });
}
