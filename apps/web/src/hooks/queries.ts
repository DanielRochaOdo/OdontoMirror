import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AdminProfile, AuditLog, Conversation, MediaFile, Message, WhatsAppAccount, WhatsAppStatus } from '../types';

type AccountRow = { id: string; name: string; phone_number: string; description: string | null; profile_name: string | null; profile_picture_url: string | null; status: WhatsAppStatus; connected: boolean; last_sync_at: string | null; last_message_at: string | null };
type ConversationRow = { id: string; whatsapp_account_id: string; conversation_type: 'individual' | 'group'; name: string; last_message_at: string | null; last_message_preview: string | null; message_count: number; contacts: { id: string; name: string; phone: string; profile_picture_url: string | null } | null };
type MessageRow = { id: string; conversation_id: string; whatsapp_account_id: string; sender_phone: string; sender_name: string | null; direction: 'inbound' | 'outbound'; message_type: Message['messageType']; text_content: string | null; sent_at: string; media_files: { id: string; media_type: MediaFile['mediaType']; mime_type: string; file_name: string | null; file_size: number | null; storage_path: string; duration: number | null } | null };
type AuditRow = { id: string; action: string; entity_type: string; entity_id: string | null; created_at: string; metadata: Record<string, unknown>; profiles: { name: string } | null; whatsapp_accounts: { name: string } | null };

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
      const { data, error } = await supabase.from('profiles').select('id,name,role,active').eq('id', user.id).single();
      if (error) throw error;
      return data as AdminProfile;
    },
  });
}
