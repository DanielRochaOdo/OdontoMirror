import { supabase } from './supabase';

export async function logAuditEvent(
  action: string,
  entityType: string,
  entityId?: string,
  whatsappAccountId?: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc('log_audit_event', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId ?? null,
    p_whatsapp_account_id: whatsappAccountId ?? null,
    p_metadata: { ...metadata, user_agent: navigator.userAgent },
  });
  if (error) console.warn('Falha ao registrar auditoria:', error.message);
}
