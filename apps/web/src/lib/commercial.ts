import { supabase } from './supabase';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function moveCommercialLead(leadId: string, statusId: string) {
  const { error } = await supabase.rpc('move_commercial_lead', {
    p_lead_id: leadId,
    p_status_id: statusId,
  });
  if (error) throw error;
}

export async function updateCommercialLeadIdentity(leadId: string, displayName: string, department?: string) {
  const { error } = await supabase.rpc('update_commercial_lead_identity', {
    p_lead_id: leadId,
    p_display_name: displayName,
    p_department: department?.trim() || null,
  });
  if (error) throw error;
}

export async function addCommercialLeadNote(leadId: string, note: string) {
  const { error } = await supabase.rpc('add_commercial_lead_note', {
    p_lead_id: leadId,
    p_note: note,
  });
  if (error) throw error;
}

export async function relinkCommercialLead(leadId: string, companyId: string) {
  const { error } = await supabase.rpc('admin_relink_commercial_lead', {
    p_lead_id: leadId,
    p_company_id: companyId,
  });
  if (error) throw error;
}

export async function createKanbanStatus(input: { name: string; position: number; isTerminal?: boolean; colorKey?: string }) {
  const baseSlug = slugify(input.name) || 'etapa';
  const { error } = await supabase.from('commercial_kanban_statuses').insert({
    name: input.name.trim(),
    slug: `${baseSlug}-${Date.now().toString(36)}`,
    position: input.position,
    color_key: input.colorKey ?? 'neutral',
    active: true,
    is_terminal: input.isTerminal ?? false,
  });
  if (error) throw error;
}

export async function updateKanbanStatus(statusId: string, patch: {
  name?: string;
  position?: number;
  active?: boolean;
  isTerminal?: boolean;
  colorKey?: string;
}) {
  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.position !== undefined) payload.position = patch.position;
  if (patch.active !== undefined) payload.active = patch.active;
  if (patch.isTerminal !== undefined) payload.is_terminal = patch.isTerminal;
  if (patch.colorKey !== undefined) payload.color_key = patch.colorKey;
  const { error } = await supabase.from('commercial_kanban_statuses').update(payload).eq('id', statusId);
  if (error) throw error;
}

export async function deleteKanbanStatus(statusId: string) {
  const { count, error: countError } = await supabase
    .from('commercial_leads')
    .select('id', { count: 'exact', head: true })
    .eq('status_id', statusId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new Error('Esta etapa possui leads. Desative-a em vez de excluir.');
  const { error } = await supabase.from('commercial_kanban_statuses').delete().eq('id', statusId);
  if (error) throw error;
}
