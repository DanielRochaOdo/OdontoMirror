import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../supabase/auth.js';
import type { WhatsAppSessionManager } from '../whatsapp/WhatsAppSessionManager.js';

const idSchema = z.object({ id: z.string().uuid() });

export async function healthRoutes(app: FastifyInstance, options: { manager?: WhatsAppSessionManager }) {
  app.get('/health', async () => ({
    ok: true,
    service: 'odonto-mirror-api',
    readOnly: true,
    timestamp: new Date().toISOString(),
  }));

  if (!options.manager) return;

  app.get('/api/sync/:id/status', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) {
      return response.code(400).send({ error: 'invalid_account_id', message: 'Identificador do WhatsApp inválido.' });
    }
    return options.manager?.getSyncProgress(parsed.data.id);
  });
}
