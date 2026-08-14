import type { FastifyInstance } from 'fastify';
import type { CommercialSyncService } from '../commercial/CommercialSyncService.js';
import { requireAdmin } from '../supabase/auth.js';
import { supabaseAdmin } from '../supabase/admin.js';

export async function commercialRoutes(app: FastifyInstance, options: { service: CommercialSyncService }) {
  app.get('/api/commercial/sync/status', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;

    const { data, error } = await supabaseAdmin
      .from('commercial_sync_runs')
      .select('id,status,started_at,finished_at,vendors_synced,companies_synced,visits_synced,leads_linked,assignments_changed,error_message,metadata')
      .order('started_at', { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    return {
      configured: options.service.isConfigured(),
      runs: data ?? [],
    };
  });

  app.post('/api/commercial/sync', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!options.service.isConfigured()) {
      return response.code(503).send({
        error: 'rotas_not_configured',
        message: 'Configure as credenciais de leitura do Rotas no servidor do Mirror.',
      });
    }
    return options.service.sync();
  });
}
