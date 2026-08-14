import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../supabase/admin.js';
import {
  fetchRotasCompanies,
  fetchRotasVendors,
  fetchRotasVisits,
  isRotasConfigured,
  type RotasCompany,
  type RotasVisit,
  type RotasVendor,
} from '../rotas/readClient.js';
import { extractPhones, normalizePhone } from './phone.js';

export { extractPhones, normalizePhone } from './phone.js';

type MirrorAuthUser = { id: string; email?: string | null };
type VendorRow = { id: string; rotas_user_id: string; mirror_user_id: string | null; email: string | null };
type CompanyRow = { id: string; rotas_cliente_id: string; company_name: string; contact_name: string | null };
type ContactRow = { id: string; whatsapp_account_id: string; name: string; phone: string; phone_normalized: string | null };
type LeadRow = {
  id: string;
  company_id: string;
  contact_id: string | null;
  linked_phone_normalized: string | null;
  link_source: 'automatic' | 'manual';
  automatic_phone_normalized?: string | null;
};
type AssignmentRow = { id: string; lead_id: string; vendor_id: string };
type ConversationRow = { id: string; contact_id: string | null; external_chat_id: string };
type MessageMetricRow = { conversation_id: string; direction: 'inbound' | 'outbound'; sent_at: string };

type SyncSummary = {
  runId: string;
  vendorsSynced: number;
  companiesSynced: number;
  visitsSynced: number;
  leadsLinked: number;
  assignmentsChanged: number;
  ambiguousPhones: number;
};

const BATCH_SIZE = 500;
const PAGE_SIZE = 1000;
const FORTALEZA_TIME_ZONE = 'America/Fortaleza';

function chunks<T>(items: T[], size = BATCH_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function normalizedEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function todayInFortaleza() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FORTALEZA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Não foi possível resolver a data local de Fortaleza.');
  return `${year}-${month}-${day}`;
}

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function listMirrorAuthUsers() {
  const byEmail = new Map<string, MirrorAuthUser>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Mirror/auth: ${error.message}`);
    for (const user of data.users) {
      const email = normalizedEmail(user.email);
      if (email) byEmail.set(email, { id: user.id, email: user.email });
    }
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

async function syncVendorUsers(vendors: RotasVendor[], startedAt: string) {
  const currentRows = await fetchAll<VendorRow>('commercial_vendors', 'id,rotas_user_id,mirror_user_id,email');
  const currentByRotasId = new Map(currentRows.map((row) => [row.rotas_user_id, row]));
  const authByEmail = await listMirrorAuthUsers();
  let emailCollisions = 0;

  for (const vendor of vendors) {
    const existing = currentByRotasId.get(vendor.userId);
    const email = normalizedEmail(vendor.email);
    let mirrorUserId = existing?.mirror_user_id ?? null;

    if (mirrorUserId && email) {
      const { data: mirrorAuth } = await supabaseAdmin.auth.admin.getUserById(mirrorUserId);
      if (mirrorAuth?.user?.email?.toLowerCase() !== email) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(mirrorUserId, { email, email_confirm: true });
        if (error) throw new Error(`Mirror/auth update ${vendor.name}: ${error.message}`);
      }
    }

    if (!mirrorUserId && email) {
      const candidate = authByEmail.get(email);
      if (candidate) {
        const { data: candidateProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', candidate.id).maybeSingle();
        if (candidateProfile?.role === 'admin') {
          emailCollisions += 1;
        } else {
          mirrorUserId = candidate.id;
        }
      } else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: `${randomUUID()}Aa1!`,
          email_confirm: true,
          user_metadata: { source: 'odontoart-rotas', rotas_user_id: vendor.userId, name: vendor.name },
        });
        if (error || !created.user) throw new Error(`Mirror/auth create ${vendor.name}: ${error?.message ?? 'falha desconhecida'}`);
        mirrorUserId = created.user.id;
        authByEmail.set(email, { id: created.user.id, email });
      }
    }

    if (mirrorUserId) {
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: mirrorUserId,
        name: vendor.name,
        role: 'seller',
        active: vendor.active,
        rotas_user_id: vendor.userId,
        email,
        synced_from_rotas: true,
        last_synced_at: startedAt,
        updated_at: startedAt,
      }, { onConflict: 'id' });
      if (profileError) throw new Error(`Mirror/profiles ${vendor.name}: ${profileError.message}`);
    }

    const { error: vendorError } = await supabaseAdmin.from('commercial_vendors').upsert({
      rotas_user_id: vendor.userId,
      mirror_user_id: mirrorUserId,
      name: vendor.name,
      email,
      active: vendor.active,
      supervisor_rotas_user_id: vendor.supervisorUserId,
      last_synced_at: startedAt,
      updated_at: startedAt,
    }, { onConflict: 'rotas_user_id' });
    if (vendorError) throw new Error(`Mirror/commercial_vendors ${vendor.name}: ${vendorError.message}`);
  }

  const activeIds = new Set(vendors.map((vendor) => vendor.userId));
  for (const row of currentRows) {
    if (activeIds.has(row.rotas_user_id)) continue;
    await supabaseAdmin.from('commercial_vendors').update({ active: false, last_synced_at: startedAt }).eq('id', row.id);
    if (row.mirror_user_id) {
      await supabaseAdmin.from('profiles').update({ active: false, last_synced_at: startedAt }).eq('id', row.mirror_user_id);
    }
  }

  return { emailCollisions };
}

async function syncCompanies(companies: RotasCompany[], startedAt: string) {
  const companyMap = new Map<string, CompanyRow>();
  const payload = companies.map((company) => ({
    rotas_cliente_id: company.id,
    company_code: company.code,
    company_name: company.name,
    trade_name: company.tradeName,
    contact_name: company.contactName,
    contact_raw: company.contactRaw,
    status: company.status,
    category: company.category,
    group_name: company.groupName,
    city: company.city,
    district: company.district,
    uf: company.uf,
    last_visit_at: company.lastVisitAt?.slice(0, 10) ?? null,
    last_synced_at: startedAt,
    updated_at: startedAt,
  }));

  for (const batch of chunks(payload)) {
    const { data, error } = await supabaseAdmin
      .from('commercial_companies')
      .upsert(batch, { onConflict: 'rotas_cliente_id' })
      .select('id,rotas_cliente_id,company_name,contact_name');
    if (error) throw new Error(`Mirror/commercial_companies: ${error.message}`);
    for (const row of (data ?? []) as CompanyRow[]) companyMap.set(row.rotas_cliente_id, row);
  }

  const { error: clearPhoneError } = await supabaseAdmin.from('commercial_company_phones').delete().eq('source', 'rotas');
  if (clearPhoneError) throw new Error(`Mirror/commercial_company_phones clear: ${clearPhoneError.message}`);

  const phonePayload: Array<{ company_id: string; phone_normalized: string; contact_name: string | null; source: 'rotas' }> = [];
  for (const source of companies) {
    const target = companyMap.get(source.id);
    if (!target) continue;
    for (const phone of extractPhones(source.contactRaw)) {
      phonePayload.push({ company_id: target.id, phone_normalized: phone, contact_name: source.contactName, source: 'rotas' });
    }
  }
  for (const batch of chunks(phonePayload)) {
    const { error } = await supabaseAdmin.from('commercial_company_phones').insert(batch);
    if (error) throw new Error(`Mirror/commercial_company_phones: ${error.message}`);
  }

  return companyMap;
}

async function syncVisits(visits: RotasVisit[], companyMap: Map<string, CompanyRow>, startedAt: string) {
  const payload = visits.flatMap((visit) => {
    const company = companyMap.get(visit.companyId);
    if (!company) return [];
    return [{
      rotas_visit_id: visit.id,
      company_id: company.id,
      visit_date: visit.visitDate.slice(0, 10),
      rotas_route_id: visit.routeId,
      vendor_rotas_user_id: visit.vendorUserId,
      vendor_name: visit.vendorName,
      completed_at: visit.completedAt,
      last_synced_at: startedAt,
      updated_at: startedAt,
    }];
  });

  for (const batch of chunks(payload)) {
    const { error } = await supabaseAdmin.from('commercial_visits').upsert(batch, { onConflict: 'rotas_visit_id' });
    if (error) throw new Error(`Mirror/commercial_visits: ${error.message}`);
  }

  const { error: staleError } = await supabaseAdmin.from('commercial_visits').delete().lt('last_synced_at', startedAt);
  if (staleError) throw new Error(`Mirror/commercial_visits reconcile: ${staleError.message}`);
}

async function syncLeads(companyMap: Map<string, CompanyRow>) {
  const contacts = await fetchAll<ContactRow>('contacts', 'id,whatsapp_account_id,name,phone,phone_normalized');
  const phoneRows = await fetchAll<{ company_id: string; phone_normalized: string; source: 'rotas' | 'manual' }>(
    'commercial_company_phones',
    'company_id,phone_normalized,source',
  );
  const companies = await fetchAll<{ id: string; company_name: string; contact_name: string | null }>('commercial_companies', 'id,company_name,contact_name');
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const phoneToCompanies = new Map<string, Set<string>>();
  for (const row of phoneRows) {
    if (row.source !== 'rotas') continue;
    const phone = normalizePhone(row.phone_normalized);
    if (!phone) continue;
    const set = phoneToCompanies.get(phone) ?? new Set<string>();
    set.add(row.company_id);
    phoneToCompanies.set(phone, set);
  }

  const { data: defaultStatus, error: statusError } = await supabaseAdmin
    .from('commercial_kanban_statuses')
    .select('id')
    .eq('slug', 'pos-visita')
    .single();
  if (statusError || !defaultStatus) throw new Error(`Status inicial do Kanban indisponível: ${statusError?.message ?? 'não encontrado'}`);

  const existing = await fetchAll<LeadRow>(
    'commercial_leads',
    'id,company_id,contact_id,linked_phone_normalized,link_source,automatic_phone_normalized',
  );
  const leadByCompanyPhone = new Map<string, LeadRow>();
  const manualOverrideByCompanyAutomaticPhone = new Set<string>();
  for (const lead of existing) {
    const linkedPhone = normalizePhone(lead.linked_phone_normalized);
    if (linkedPhone) leadByCompanyPhone.set(`${lead.company_id}:${linkedPhone}`, lead);
    if (lead.link_source === 'manual') {
      const automaticPhone = normalizePhone(lead.automatic_phone_normalized);
      if (automaticPhone) manualOverrideByCompanyAutomaticPhone.add(`${lead.company_id}:${automaticPhone}`);
    }
  }

  let linked = 0;
  let ambiguous = 0;
  for (const contact of contacts) {
    const phone = normalizePhone(contact.phone_normalized ?? contact.phone);
    if (!phone) continue;
    const matchedCompanies = phoneToCompanies.get(phone);
    if (!matchedCompanies?.size) continue;
    if (matchedCompanies.size !== 1) {
      ambiguous += 1;
      continue;
    }
    const companyId = [...matchedCompanies][0];
    if (!companyId) continue;
    const company = companyById.get(companyId);
    if (!company) continue;
    const key = `${companyId}:${phone}`;

    -- An administrator-selected inbox contact represents this Rotas identity. Do not
    -- recreate or overwrite an automatic card for the original Rotas phone.
    if (manualOverrideByCompanyAutomaticPhone.has(key)) continue;

    const current = leadByCompanyPhone.get(key);
    if (current) {
      if (current.link_source === 'manual') continue;
      const { error } = await supabaseAdmin.from('commercial_leads').update({
        contact_id: contact.id,
        whatsapp_account_id: contact.whatsapp_account_id,
        contact_name: company.contact_name || contact.name || null,
        contact_phone: contact.phone,
        updated_at: new Date().toISOString(),
      }).eq('id', current.id);
      if (error) throw new Error(`Mirror/commercial_leads refresh: ${error.message}`);
      continue;
    }

    const { data, error } = await supabaseAdmin.from('commercial_leads').insert({
      company_id: companyId,
      contact_id: contact.id,
      whatsapp_account_id: contact.whatsapp_account_id,
      display_name: company.company_name,
      department: null,
      contact_name: company.contact_name || contact.name || null,
      contact_phone: contact.phone,
      linked_phone_normalized: phone,
      status_id: defaultStatus.id,
      link_source: 'automatic',
    }).select('id,company_id,contact_id,linked_phone_normalized,link_source,automatic_phone_normalized').single();
    if (error || !data) throw new Error(`Mirror/commercial_leads link: ${error?.message ?? 'falha desconhecida'}`);
    const inserted = data as LeadRow;
    leadByCompanyPhone.set(key, inserted);
    linked += 1;
  }

  void companyMap;
  return { linked, ambiguous };
}

function resolveCurrentVendorsByCompany(visits: RotasVisit[], companyMap: Map<string, CompanyRow>) {
  const today = todayInFortaleza();
  const grouped = new Map<string, RotasVisit[]>();
  for (const visit of visits) {
    if (visit.visitDate.slice(0, 10) > today) continue;
    const company = companyMap.get(visit.companyId);
    if (!company) continue;
    const group = grouped.get(company.id) ?? [];
    group.push(visit);
    grouped.set(company.id, group);
  }

  const result = new Map<string, Map<string, { visitDate: string; visitIds: string[] }>>();
  for (const [companyId, companyVisits] of grouped) {
    const latestDate = companyVisits.reduce((latest, visit) => {
      const date = visit.visitDate.slice(0, 10);
      return date > latest ? date : latest;
    }, '0000-00-00');
    const vendors = new Map<string, { visitDate: string; visitIds: string[] }>();
    for (const visit of companyVisits) {
      if (visit.visitDate.slice(0, 10) !== latestDate || !visit.vendorUserId) continue;
      const existing = vendors.get(visit.vendorUserId) ?? { visitDate: latestDate, visitIds: [] };
      existing.visitIds.push(visit.id);
      vendors.set(visit.vendorUserId, existing);
    }
    result.set(companyId, vendors);
  }
  return result;
}

async function syncAssignments(visits: RotasVisit[], companyMap: Map<string, CompanyRow>) {
  const leads = await fetchAll<LeadRow>('commercial_leads', 'id,company_id,contact_id,linked_phone_normalized,link_source');
  const vendors = await fetchAll<VendorRow & { active: boolean }>('commercial_vendors', 'id,rotas_user_id,mirror_user_id,email,active');
  const vendorByRotasId = new Map(vendors.filter((vendor) => vendor.active).map((vendor) => [vendor.rotas_user_id, vendor]));
  const desiredByCompany = resolveCurrentVendorsByCompany(visits, companyMap);
  const activeAssignments = await fetchAll<AssignmentRow>('commercial_lead_assignments', 'id,lead_id,vendor_id');
  const assignmentsByLead = new Map<string, AssignmentRow[]>();
  for (const assignment of activeAssignments) {
    const group = assignmentsByLead.get(assignment.lead_id) ?? [];
    group.push(assignment);
    assignmentsByLead.set(assignment.lead_id, group);
  }

  const now = new Date().toISOString();
  let changed = 0;
  for (const lead of leads) {
    const desiredSources = desiredByCompany.get(lead.company_id) ?? new Map();
    const desiredVendorIds = new Map<string, { visitDate: string; visitIds: string[] }>();
    for (const [rotasUserId, source] of desiredSources) {
      const vendor = vendorByRotasId.get(rotasUserId);
      if (vendor) desiredVendorIds.set(vendor.id, source);
    }

    const current = assignmentsByLead.get(lead.id) ?? [];
    const currentVendorIds = new Set(current.map((assignment) => assignment.vendor_id));

    for (const assignment of current) {
      if (desiredVendorIds.has(assignment.vendor_id)) {
        const source = desiredVendorIds.get(assignment.vendor_id);
        if (source) {
          await supabaseAdmin.from('commercial_lead_assignments').update({
            source: 'route',
            source_visit_date: source.visitDate,
            source_visit_ids: source.visitIds,
            updated_at: now,
          }).eq('id', assignment.id);
        }
        continue;
      }
      const { error } = await supabaseAdmin.from('commercial_lead_assignments').update({ active: false, ended_at: now, updated_at: now }).eq('id', assignment.id);
      if (error) throw new Error(`Mirror/commercial_lead_assignments end: ${error.message}`);
      changed += 1;
    }

    for (const [vendorId, source] of desiredVendorIds) {
      if (currentVendorIds.has(vendorId)) continue;
      const { error } = await supabaseAdmin.from('commercial_lead_assignments').insert({
        lead_id: lead.id,
        vendor_id: vendorId,
        source: 'route',
        source_visit_date: source.visitDate,
        source_visit_ids: source.visitIds,
        active: true,
        started_at: now,
      });
      if (error) throw new Error(`Mirror/commercial_lead_assignments create: ${error.message}`);
      changed += 1;
    }
  }

  return changed;
}

async function syncMetrics(visits: RotasVisit[], companyMap: Map<string, CompanyRow>) {
  const leads = await fetchAll<LeadRow>('commercial_leads', 'id,company_id,contact_id,linked_phone_normalized,link_source');
  const contacts = await fetchAll<ContactRow>('contacts', 'id,whatsapp_account_id,name,phone,phone_normalized');
  const contactPhone = new Map(contacts.map((contact) => [contact.id, normalizePhone(contact.phone_normalized ?? contact.phone)]));
  const conversations = await fetchAll<ConversationRow>('conversations', 'id,contact_id,external_chat_id');
  const conversationPhone = new Map<string, string>();
  for (const conversation of conversations) {
    const contactValue = conversation.contact_id ? contactPhone.get(conversation.contact_id) : null;
    const phone = contactValue ?? normalizePhone(conversation.external_chat_id);
    if (phone) conversationPhone.set(conversation.id, phone);
  }

  const messages = await fetchAll<MessageMetricRow>('messages', 'conversation_id,direction,sent_at');
  const messagesByPhone = new Map<string, MessageMetricRow[]>();
  for (const message of messages) {
    const phone = conversationPhone.get(message.conversation_id);
    if (!phone) continue;
    const group = messagesByPhone.get(phone) ?? [];
    group.push(message);
    messagesByPhone.set(phone, group);
  }
  for (const group of messagesByPhone.values()) group.sort((a, b) => a.sent_at.localeCompare(b.sent_at));

  const completedVisitsByCompany = new Map<string, RotasVisit[]>();
  for (const visit of visits) {
    if (!visit.completedAt) continue;
    const company = companyMap.get(visit.companyId);
    if (!company) continue;
    const group = completedVisitsByCompany.get(company.id) ?? [];
    group.push(visit);
    completedVisitsByCompany.set(company.id, group);
  }

  const now = Date.now();
  const metricsPayload = leads.map((lead) => {
    const completedVisits = completedVisitsByCompany.get(lead.company_id) ?? [];
    const lastVisit = completedVisits.reduce<RotasVisit | null>((latest, visit) => {
      if (!latest) return visit;
      return (visit.completedAt ?? '') > (latest.completedAt ?? '') ? visit : latest;
    }, null);
    const lastVisitAt = lastVisit?.completedAt ?? null;
    const leadPhone = normalizePhone(lead.linked_phone_normalized);
    const phoneMessages = leadPhone ? messagesByPhone.get(leadPhone) ?? [] : [];
    const lastInteraction = phoneMessages.length ? phoneMessages[phoneMessages.length - 1]?.sent_at ?? null : null;
    const afterVisit = lastVisitAt ? phoneMessages.filter((message) => message.sent_at >= lastVisitAt) : [];
    const firstAfterVisit = afterVisit[0]?.sent_at ?? null;
    const daysWithoutInteraction = lastInteraction ? Math.max(0, Math.floor((now - new Date(lastInteraction).getTime()) / 86_400_000)) : null;
    const temperature = daysWithoutInteraction === null
      ? 'unknown'
      : daysWithoutInteraction <= 2
        ? 'hot'
        : daysWithoutInteraction <= 5
          ? 'warm'
          : daysWithoutInteraction <= 10
            ? 'cold'
            : 'stopped';
    const followupDelayMinutes = lastVisitAt && firstAfterVisit
      ? Math.max(0, Math.round((new Date(firstAfterVisit).getTime() - new Date(lastVisitAt).getTime()) / 60_000))
      : null;

    return {
      lead_id: lead.id,
      last_visit_at: lastVisitAt,
      first_interaction_after_visit_at: firstAfterVisit,
      last_interaction_at: lastInteraction,
      interaction_count_after_visit: afterVisit.length,
      inbound_count_after_visit: afterVisit.filter((message) => message.direction === 'inbound').length,
      outbound_count_after_visit: afterVisit.filter((message) => message.direction === 'outbound').length,
      followup_delay_minutes: followupDelayMinutes,
      days_without_interaction: daysWithoutInteraction,
      no_followup: Boolean(lastVisitAt && afterVisit.length === 0),
      temperature,
      updated_at: new Date().toISOString(),
    };
  });

  for (const batch of chunks(metricsPayload)) {
    const { error } = await supabaseAdmin.from('commercial_lead_metrics').upsert(batch, { onConflict: 'lead_id' });
    if (error) throw new Error(`Mirror/commercial_lead_metrics: ${error.message}`);
  }
}

export class CommercialSyncService {
  private inFlight: Promise<SyncSummary> | null = null;
  private timer: NodeJS.Timeout | null = null;

  isConfigured() {
    return isRotasConfigured();
  }

  start() {
    if (!this.isConfigured() || this.timer) return;
    void this.sync().catch((error: unknown) => console.error('[commercial-sync] initial sync failed', error));
    this.timer = setInterval(() => {
      void this.sync().catch((error: unknown) => console.error('[commercial-sync] scheduled sync failed', error));
    }, env.ROTAS_SYNC_INTERVAL_SECONDS * 1000);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  sync(): Promise<SyncSummary> {
    if (!this.isConfigured()) return Promise.reject(new Error('Integração com o Rotas não configurada.'));
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.runSync().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async runSync(): Promise<SyncSummary> {
    const startedAt = new Date().toISOString();
    const { data: run, error: runError } = await supabaseAdmin
      .from('commercial_sync_runs')
      .insert({ status: 'running', started_at: startedAt })
      .select('id')
      .single();
    if (runError || !run) throw new Error(`Mirror/commercial_sync_runs: ${runError?.message ?? 'não criado'}`);

    try {
      const [vendors, companies, visits] = await Promise.all([
        fetchRotasVendors(),
        fetchRotasCompanies(),
        fetchRotasVisits(),
      ]);

      const vendorResult = await syncVendorUsers(vendors, startedAt);
      const companyMap = await syncCompanies(companies, startedAt);
      await syncVisits(visits, companyMap, startedAt);
      const leadResult = await syncLeads(companyMap);
      const assignmentsChanged = await syncAssignments(visits, companyMap);
      await syncMetrics(visits, companyMap);

      const summary: SyncSummary = {
        runId: run.id as string,
        vendorsSynced: vendors.length,
        companiesSynced: companies.length,
        visitsSynced: visits.length,
        leadsLinked: leadResult.linked,
        assignmentsChanged,
        ambiguousPhones: leadResult.ambiguous,
      };

      const { error: finishError } = await supabaseAdmin.from('commercial_sync_runs').update({
        status: 'success',
        finished_at: new Date().toISOString(),
        vendors_synced: summary.vendorsSynced,
        companies_synced: summary.companiesSynced,
        visits_synced: summary.visitsSynced,
        leads_linked: summary.leadsLinked,
        assignments_changed: summary.assignmentsChanged,
        metadata: { ambiguous_phones: summary.ambiguousPhones, vendor_email_collisions: vendorResult.emailCollisions },
      }).eq('id', summary.runId);
      if (finishError) throw new Error(`Mirror/commercial_sync_runs finish: ${finishError.message}`);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida';
      await supabaseAdmin.from('commercial_sync_runs').update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: message,
      }).eq('id', run.id);
      throw error;
    }
  }
}
