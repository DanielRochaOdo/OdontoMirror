import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../supabase/auth.js';
import { supabaseAdmin } from '../supabase/admin.js';
import { WhatsAppSessionManager } from '../whatsapp/WhatsAppSessionManager.js';

const idSchema = z.object({ id: z.string().uuid() });
const accountSchema = z.object({ name: z.string().min(2).max(80), description: z.string().max(120).optional() });

async function writeAudit(request: { ip: string; headers: Record<string, unknown> }, adminId: string, action: string, entityId: string, accountId: string | null, label: string) {
  await supabaseAdmin.from('audit_logs').insert({
    admin_id: adminId,
    action,
    entity_type: 'whatsapp_account',
    entity_id: entityId,
    whatsapp_account_id: accountId,
    ip_address: request.ip,
    user_agent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
    metadata: { entity_label: label },
  });
}

async function accountExists(id: string) {
  const { data } = await supabaseAdmin.from('whatsapp_accounts').select('id').eq('id', id).maybeSingle();
  return Boolean(data);
}

export async function whatsappRoutes(app: FastifyInstance, options: { manager: WhatsAppSessionManager }) {
  const { manager } = options;

  app.post('/api/whatsapp/accounts', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = accountSchema.safeParse(request.body);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account', message: 'Nome ou descrição inválidos.' });
    const { data: account, error } = await supabaseAdmin.from('whatsapp_accounts').insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      phone_number: '',
      status: 'connecting',
      connected: false,
    }).select('id,name,description').single();
    if (error) return response.code(500).send({ error: 'account_create_failed', message: error.message });
    try { await manager.create(account.id); }
    catch (cause) {
      await supabaseAdmin.from('whatsapp_accounts').update({ status: 'error' }).eq('id', account.id);
      return response.code(500).send({ error: 'session_create_failed', message: cause instanceof Error ? cause.message : 'Falha ao iniciar sessão.' });
    }
    await writeAudit(request, admin.id, 'CONNECT_WHATSAPP', account.id, account.id, account.name);
    return response.code(201).send({ accountId: account.id, name: account.name, description: account.description ?? undefined, status: await manager.status(account.id) });
  });

  app.post('/api/whatsapp/:id/connect', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' });
    if (!await accountExists(parsed.data.id)) return response.code(404).send({ error: 'account_not_found' });
    const status = await manager.create(parsed.data.id);
    const { data: account } = await supabaseAdmin.from('whatsapp_accounts').select('name').eq('id', parsed.data.id).single();
    await writeAudit(request, admin.id, 'CONNECT_WHATSAPP', parsed.data.id, parsed.data.id, account?.name ?? 'WhatsApp');
    return { accountId: parsed.data.id, status };
  });

  app.post('/api/whatsapp/:id/disconnect', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' });
    if (!await accountExists(parsed.data.id)) return response.code(404).send({ error: 'account_not_found' });
    const { data: account } = await supabaseAdmin.from('whatsapp_accounts').select('name').eq('id', parsed.data.id).single();
    const status = await manager.disconnect(parsed.data.id);
    await writeAudit(request, admin.id, 'DISCONNECT_WHATSAPP', parsed.data.id, parsed.data.id, account?.name ?? 'WhatsApp');
    return { accountId: parsed.data.id, status };
  });

  app.post('/api/whatsapp/:id/sync', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' });
    if (!await accountExists(parsed.data.id)) return response.code(404).send({ error: 'account_not_found' });
    const { data: account } = await supabaseAdmin.from('whatsapp_accounts').select('name').eq('id', parsed.data.id).single();
    void manager.sync(parsed.data.id).catch((error: unknown) => request.log.error({ accountId: parsed.data.id, error: error instanceof Error ? error.message : String(error) }, 'whatsapp sync failed'));
    await writeAudit(request, admin.id, 'SYNC_WHATSAPP', parsed.data.id, parsed.data.id, account?.name ?? 'WhatsApp');
    return response.code(202).send({ accepted: true });
  });

  app.get('/api/whatsapp/:id/status', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' });
    if (!await accountExists(parsed.data.id)) return response.code(404).send({ error: 'account_not_found' });
    return { accountId: parsed.data.id, status: await manager.status(parsed.data.id) };
  });

  app.get('/api/whatsapp/:id/qr', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' });
    if (!await accountExists(parsed.data.id)) return response.code(404).send({ error: 'account_not_found' });
    return { accountId: parsed.data.id, qrCode: await manager.qr(parsed.data.id) };
  });

  app.delete('/api/whatsapp/:id', async (request, response) => {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) return response.code(400).send({ error: 'invalid_account_id' });
    if (!await accountExists(parsed.data.id)) return response.code(404).send({ error: 'account_not_found' });
    const { data: account } = await supabaseAdmin.from('whatsapp_accounts').select('name').eq('id', parsed.data.id).single();
    await writeAudit(request, admin.id, 'REMOVE_WHATSAPP', parsed.data.id, parsed.data.id, account?.name ?? 'WhatsApp');
    await manager.remove(parsed.data.id);
    const { data: messageRows } = await supabaseAdmin.from('messages').select('id').eq('whatsapp_account_id', parsed.data.id);
    const messageIds = (messageRows ?? []).map((row) => row.id as string);
    if (messageIds.length) {
      const { data: mediaRows } = await supabaseAdmin.from('media_files').select('storage_path').in('message_id', messageIds);
      const paths = (mediaRows ?? []).map((row) => row.storage_path as string).filter(Boolean);
      if (paths.length) await supabaseAdmin.storage.from('whatsapp-media').remove(paths);
    }
    const { error } = await supabaseAdmin.from('whatsapp_accounts').delete().eq('id', parsed.data.id);
    if (error) return response.code(500).send({ error: 'account_remove_failed', message: error.message });
    return { removed: true };
  });
}
