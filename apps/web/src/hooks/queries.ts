import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  AdminProfile,
  AuditLog,
  CommercialCompany,
  CommercialLead,
  CommercialLeadAssignment,
  CommercialLeadMetrics,
  CommercialLeadNote,
  CommercialLeadStatusHistory,
  CommercialVendor,
  Conversation,
  KanbanStatus,
  MediaFile,
  Message,
  UserProfile,
  WhatsAppAccount,
  WhatsAppStatus,
} from '../types';

type AccountRow = { id: string; name: string; phone_number: string; description: string | null; profile_name: string | null; profile_picture_url: string | null; status: WhatsAppStatus; connected: boolean; last_sync_at: string | null; last_message_at: string | null };
type ConversationRow = { id: string; whatsapp_account_id: string; conversation_type: 'individual' | 'group'; name: string; last_message_at: string | null; last_message_preview: string | null; message_count: number; contacts: { id: string; name: string; phone: string; profile_picture_url: string | null } | null };
type MessageRow = { id: string; conversation_id: string; whatsapp_account_id: string; sender_phone: string; sender_name: string | null; direction: 'inbound' | 'outbound'; message_type: Message['messageType']; text_content: string | null; sent_at: string; media_files: { id: string; media_type: MediaFile['mediaType']; mime_type: string; file_name: string | null; file_size: number | null; storage_path: string; duration: number | null } | null };
type AuditRow = { id: string; action: string; entity_type: string; entity_id: string | null; created_at: string; metadata: Record<string, unknown>; profiles: { name: string } | null; whatsapp_accounts: { name: string } | null };
type StatusRow = { id: string; name: string; slug: string; position: number; color_key: string; active: boolean; is_terminal: boolean };
type VendorRow = { id: string; rotas_user_id: string; name: string; email: string | null; active: boolean };
type CompanyRow = { id: string; rotas_cliente_id: string; company_code: string | null; company_name: string; trade_name: string | null; contact_name: string | null; status: string | null; category: string | null; group_name: string | null; city: string | null; district: string | null; uf: string | null; last_visit_at: string | null };
type LeadRow = { id: string; company_id: string; display_name: string; department: string | null; contact_name: string | null; contact_phone: string | null; linked_phone_normalized: string | null; status_id: string; link_source: 'automatic' | 'manual'; last_status_changed_at: string };
type AssignmentRow = { id: string; lead_id: string; vendor_id: string; source: 'route' | 'manual'; source_visit_date: string | null; started_at: string };
type MetricsRow = { lead_id: string; last_visit_at: string | null; first_interaction_after_visit_at: string | null; last_interaction_at: string | null; interaction_count_after_visit: number; inbound_count_after_visit: number; outbound_count_after_visit: number; followup_delay_minutes: number | null; days_without_interaction: number | null; no_followup: boolean; temperature: CommercialLeadMetrics['temperature'] };
type HistoryRow = { id: string; lead_id: string; from_status_id: string | null; to_status_id: string; changed_by_name: string | null; changed_by_role: string | null; created_at: string };
type NoteRow = { id: string; lead_id: string; author_name: string | null; note: string; created_at: string };

async function conversationCount(accountId: string) {
  const { count, error } = await supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('whatsapp_account_id', accountId);
  if (error) throw error;
  return count ?? 0;
}

function mapAccount(row: AccountRow, count: number): WhatsAppAccount {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number || 'Aguardando conexão',
    description: row.description ?? undefined,
    profileName: row.profile_name ?? undefined,
    profilePictureUrl: row.profile_picture_url ?? undefined,
    status: row.status,
    connected: row.connected,
    conversationCount: count,
    lastSyncAt: row.last_sync_at ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
  };
}

export function useWhatsAppAccounts() {
  return useQuery({
    queryKey: ['whatsapp-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('whatsapp_accounts').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as AccountRow[];
      const counts = await Promise.all(rows.map((row) => conversationCount(row.id)));
      return rows.map((row, index) => mapAccount(row, counts[index] ?? 0));
    },
  });
}

export function useWhatsAppAccount(accountId?: string) {
  return useQuery({
    queryKey: ['whatsapp-account', accountId],
    enabled: Boolean(accountId),
    queryFn: async () => {
      const { data, error } = await supabase.from('whatsapp_accounts').select('*').eq('id', accountId!).single();
      if (error) throw error;
      return mapAccount(data as AccountRow, await conversationCount(accountId!));
    },
  });
}

function mapConversation(row: ConversationRow): Conversation {
  const contact = row.contacts ?? { id: row.id, name: row.name, phone: '', profile_picture_url: null };
  return {
    id: row.id,
    whatsappAccountId: row.whatsapp_account_id,
    contact: { id: contact.id, name: contact.name || row.name, phone: contact.phone, profilePictureUrl: contact.profile_picture_url ?? undefined },
    conversationType: row.conversation_type,
    lastMessageAt: row.last_message_at ?? undefined,
    lastMessagePreview: row.last_message_preview ?? '',
    messageCount: row.message_count,
  };
}

export function useConversations(accountId?: string, search = '') {
  return useQuery({
    queryKey: ['conversations', accountId, search],
    enabled: Boolean(accountId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, whatsapp_account_id, conversation_type, name, last_message_at, last_message_preview, message_count, contacts(id,name,phone,profile_picture_url)')
        .eq('whatsapp_account_id', accountId!)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      const needle = search.trim().toLowerCase();
      return ((data ?? []) as unknown as ConversationRow[]).map(mapConversation).filter((item) => !needle || `${item.contact.name} ${item.contact.phone} ${item.lastMessagePreview}`.toLowerCase().includes(needle));
    },
  });
}

export function useConversation(accountId?: string, conversationId?: string) {
  return useQuery({
    queryKey: ['conversation', accountId, conversationId],
    enabled: Boolean(accountId && conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, whatsapp_account_id, conversation_type, name, last_message_at, last_message_preview, message_count, contacts(id,name,phone,profile_picture_url)')
        .eq('id', conversationId!)
        .eq('whatsapp_account_id', accountId!)
        .single();
      if (error) throw error;
      return mapConversation(data as unknown as ConversationRow);
    },
  });
}

export function useMessages(accountId?: string, conversationId?: string) {
  return useQuery({
    queryKey: ['messages', accountId, conversationId],
    enabled: Boolean(accountId && conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, whatsapp_account_id, sender_phone, sender_name, direction, message_type, text_content, sent_at, media_files!messages_media_id_fkey(id,media_type,mime_type,file_name,file_size,storage_path,duration)')
        .eq('whatsapp_account_id', accountId!)
        .eq('conversation_id', conversationId!)
        .order('sent_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as MessageRow[];
      const mapped = await Promise.all(rows.map(async (row): Promise<Message> => {
        let media: MediaFile | undefined;
        if (row.media_files) {
          const { data: signed } = await supabase.storage.from('whatsapp-media').createSignedUrl(row.media_files.storage_path, 300);
          media = {
            id: row.media_files.id,
            mediaType: row.media_files.media_type,
            mimeType: row.media_files.mime_type,
            fileName: row.media_files.file_name ?? 'arquivo',
            fileSize: row.media_files.file_size ?? 0,
            duration: row.media_files.duration ?? undefined,
            url: signed?.signedUrl,
          };
        }
        return {
          id: row.id,
          conversationId: row.conversation_id,
          whatsappAccountId: row.whatsapp_account_id,
          senderPhone: row.sender_phone,
          senderName: row.sender_name ?? row.sender_phone,
          direction: row.direction,
          messageType: row.message_type,
          textContent: row.text_content ?? undefined,
          sentAt: row.sent_at,
          media,
        };
      }));
      return mapped.reverse();
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id,action,entity_type,entity_id,created_at,metadata,profiles!audit_logs_admin_id_fkey(name),whatsapp_accounts(name)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as unknown as AuditRow[]).map((row): AuditLog => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityLabel: typeof row.metadata?.entity_label === 'string' ? row.metadata.entity_label : row.whatsapp_accounts?.name ?? row.entity_type,
        adminName: row.profiles?.name ?? 'Administrador',
        whatsappAccountName: row.whatsapp_accounts?.name ?? undefined,
        createdAt: row.created_at,
        metadata: row.metadata ?? {},
      }));
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['admin-profile'],
    queryFn: async (): Promise<AdminProfile> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');
      const { data, error } = await supabase.from('profiles').select('id,name,role,active,rotas_user_id,email').eq('id', user.id).single();
      if (error) throw error;
      const row = data as { id: string; name: string; role: UserProfile['role']; active: boolean; rotas_user_id: string | null; email: string | null };
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        active: row.active,
        rotasUserId: row.rotas_user_id ?? undefined,
        email: row.email ?? user.email ?? undefined,
      };
    },
  });
}

export function useKanbanStatuses(includeInactive = false) {
  return useQuery({
    queryKey: ['commercial-kanban-statuses', includeInactive],
    queryFn: async (): Promise<KanbanStatus[]> => {
      let query = supabase.from('commercial_kanban_statuses').select('id,name,slug,position,color_key,active,is_terminal').order('position', { ascending: true });
      if (!includeInactive) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as StatusRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        position: row.position,
        colorKey: row.color_key,
        active: row.active,
        isTerminal: row.is_terminal,
      }));
    },
  });
}

export function useCommercialVendors() {
  return useQuery({
    queryKey: ['commercial-vendors'],
    queryFn: async (): Promise<CommercialVendor[]> => {
      const { data, error } = await supabase.from('commercial_vendors').select('id,rotas_user_id,name,email,active').order('name');
      if (error) throw error;
      return ((data ?? []) as VendorRow[]).map((row) => ({
        id: row.id,
        rotasUserId: row.rotas_user_id,
        name: row.name,
        email: row.email ?? undefined,
        active: row.active,
      }));
    },
  });
}

export function useCommercialCompanies() {
  return useQuery({
    queryKey: ['commercial-companies'],
    queryFn: async (): Promise<CommercialCompany[]> => {
      const { data, error } = await supabase.from('commercial_companies').select('id,rotas_cliente_id,company_code,company_name,trade_name,contact_name,status,category,group_name,city,district,uf,last_visit_at').order('company_name');
      if (error) throw error;
      return ((data ?? []) as CompanyRow[]).map(mapCompany);
    },
  });
}

function mapCompany(row: CompanyRow): CommercialCompany {
  return {
    id: row.id,
    rotasClienteId: row.rotas_cliente_id,
    companyCode: row.company_code ?? undefined,
    companyName: row.company_name,
    tradeName: row.trade_name ?? undefined,
    contactName: row.contact_name ?? undefined,
    status: row.status ?? undefined,
    category: row.category ?? undefined,
    groupName: row.group_name ?? undefined,
    city: row.city ?? undefined,
    district: row.district ?? undefined,
    uf: row.uf ?? undefined,
    lastVisitAt: row.last_visit_at ?? undefined,
  };
}

function emptyMetrics(): CommercialLeadMetrics {
  return {
    interactionCountAfterVisit: 0,
    inboundCountAfterVisit: 0,
    outboundCountAfterVisit: 0,
    noFollowup: false,
    temperature: 'unknown',
  };
}

export function useCommercialLeads() {
  return useQuery({
    queryKey: ['commercial-leads'],
    queryFn: async (): Promise<CommercialLead[]> => {
      const [leadResult, companyResult, assignmentResult, vendorResult, metricResult] = await Promise.all([
        supabase.from('commercial_leads').select('id,company_id,display_name,department,contact_name,contact_phone,linked_phone_normalized,status_id,link_source,last_status_changed_at').eq('archived', false),
        supabase.from('commercial_companies').select('id,rotas_cliente_id,company_code,company_name,trade_name,contact_name,status,category,group_name,city,district,uf,last_visit_at'),
        supabase.from('commercial_lead_assignments').select('id,lead_id,vendor_id,source,source_visit_date,started_at').eq('active', true),
        supabase.from('commercial_vendors').select('id,rotas_user_id,name,email,active'),
        supabase.from('commercial_lead_metrics').select('lead_id,last_visit_at,first_interaction_after_visit_at,last_interaction_at,interaction_count_after_visit,inbound_count_after_visit,outbound_count_after_visit,followup_delay_minutes,days_without_interaction,no_followup,temperature'),
      ]);
      for (const result of [leadResult, companyResult, assignmentResult, vendorResult, metricResult]) if (result.error) throw result.error;

      const companies = new Map(((companyResult.data ?? []) as CompanyRow[]).map((row) => [row.id, mapCompany(row)]));
      const vendors = new Map(((vendorResult.data ?? []) as VendorRow[]).map((row) => [row.id, {
        id: row.id,
        rotasUserId: row.rotas_user_id,
        name: row.name,
        email: row.email ?? undefined,
        active: row.active,
      } satisfies CommercialVendor]));
      const assignments = new Map<string, CommercialLeadAssignment[]>();
      for (const row of (assignmentResult.data ?? []) as AssignmentRow[]) {
        const vendor = vendors.get(row.vendor_id);
        if (!vendor) continue;
        const group = assignments.get(row.lead_id) ?? [];
        group.push({
          id: row.id,
          vendor,
          source: row.source,
          sourceVisitDate: row.source_visit_date ?? undefined,
          startedAt: row.started_at,
        });
        assignments.set(row.lead_id, group);
      }
      const metrics = new Map<string, CommercialLeadMetrics>();
      for (const row of (metricResult.data ?? []) as MetricsRow[]) {
        metrics.set(row.lead_id, {
          lastVisitAt: row.last_visit_at ?? undefined,
          firstInteractionAfterVisitAt: row.first_interaction_after_visit_at ?? undefined,
          lastInteractionAt: row.last_interaction_at ?? undefined,
          interactionCountAfterVisit: row.interaction_count_after_visit,
          inboundCountAfterVisit: row.inbound_count_after_visit,
          outboundCountAfterVisit: row.outbound_count_after_visit,
          followupDelayMinutes: row.followup_delay_minutes ?? undefined,
          daysWithoutInteraction: row.days_without_interaction ?? undefined,
          noFollowup: row.no_followup,
          temperature: row.temperature,
        });
      }

      return ((leadResult.data ?? []) as LeadRow[]).flatMap((row) => {
        const company = companies.get(row.company_id);
        if (!company) return [];
        return [{
          id: row.id,
          company,
          displayName: row.display_name,
          department: row.department ?? undefined,
          contactName: row.contact_name ?? undefined,
          contactPhone: row.contact_phone ?? undefined,
          linkedPhoneNormalized: row.linked_phone_normalized ?? undefined,
          statusId: row.status_id,
          linkSource: row.link_source,
          lastStatusChangedAt: row.last_status_changed_at,
          assignments: assignments.get(row.id) ?? [],
          metrics: metrics.get(row.id) ?? emptyMetrics(),
        }];
      });
    },
  });
}

export function useCommercialLeadHistory(leadId?: string) {
  return useQuery({
    queryKey: ['commercial-lead-history', leadId],
    enabled: Boolean(leadId),
    queryFn: async (): Promise<CommercialLeadStatusHistory[]> => {
      const { data, error } = await supabase.from('commercial_lead_status_history').select('id,lead_id,from_status_id,to_status_id,changed_by_name,changed_by_role,created_at').eq('lead_id', leadId!).order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as HistoryRow[]).map((row) => ({
        id: row.id,
        leadId: row.lead_id,
        fromStatusId: row.from_status_id ?? undefined,
        toStatusId: row.to_status_id,
        changedByName: row.changed_by_name ?? undefined,
        changedByRole: row.changed_by_role ?? undefined,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useCommercialLeadNotes(leadId?: string) {
  return useQuery({
    queryKey: ['commercial-lead-notes', leadId],
    enabled: Boolean(leadId),
    queryFn: async (): Promise<CommercialLeadNote[]> => {
      const { data, error } = await supabase.from('commercial_lead_notes').select('id,lead_id,author_name,note,created_at').eq('lead_id', leadId!).order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as NoteRow[]).map((row) => ({
        id: row.id,
        leadId: row.lead_id,
        authorName: row.author_name ?? undefined,
        note: row.note,
        createdAt: row.created_at,
      }));
    },
  });
}
