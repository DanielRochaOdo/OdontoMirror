import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface WhatsAppVendorAssignment {
  whatsappAccountId: string;
  vendorId: string;
  assignedAt: string;
  assignedByProfileId?: string;
}

export interface WhatsAppVendorAssignmentHistory {
  id: string;
  whatsappAccountId?: string;
  whatsappAccountName: string;
  whatsappPhoneNumber?: string;
  vendorId?: string;
  vendorName: string;
  vendorEmail?: string;
  startedAt: string;
  endedAt: string;
  changedByName?: string;
  changeReason: 'transfer' | 'unlink';
}

export interface VendorConversationSummary {
  id: string;
  whatsappAccountId: string;
  contactName: string;
  contactPhone: string;
  lastMessageAt?: string;
  lastMessagePreview: string;
  messageCount: number;
}

type AssignmentRow = {
  whatsapp_account_id: string;
  vendor_id: string;
  assigned_at: string;
  assigned_by_profile_id: string | null;
};

type HistoryRow = {
  id: string;
  whatsapp_account_id: string | null;
  whatsapp_account_name: string;
  whatsapp_phone_number: string | null;
  vendor_id: string | null;
  vendor_name: string;
  vendor_email: string | null;
  started_at: string;
  ended_at: string;
  changed_by_name: string | null;
  change_reason: 'transfer' | 'unlink';
};

type ConversationRow = {
  id: string;
  whatsapp_account_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  message_count: number;
  name: string;
  contacts: { name: string; phone: string } | null;
};

export function useWhatsAppVendorAssignments() {
  return useQuery({
    queryKey: ['whatsapp-vendor-assignments'],
    queryFn: async (): Promise<WhatsAppVendorAssignment[]> => {
      const { data, error } = await supabase
        .from('whatsapp_vendor_assignments')
        .select('whatsapp_account_id,vendor_id,assigned_at,assigned_by_profile_id');
      if (error) throw error;
      return ((data ?? []) as AssignmentRow[]).map((row) => ({
        whatsappAccountId: row.whatsapp_account_id,
        vendorId: row.vendor_id,
        assignedAt: row.assigned_at,
        assignedByProfileId: row.assigned_by_profile_id ?? undefined,
      }));
    },
  });
}

export function useWhatsAppVendorAssignmentHistory(accountId?: string) {
  return useQuery({
    queryKey: ['whatsapp-vendor-assignment-history', accountId],
    enabled: Boolean(accountId),
    queryFn: async (): Promise<WhatsAppVendorAssignmentHistory[]> => {
      const { data, error } = await supabase
        .from('whatsapp_vendor_assignment_history')
        .select('id,whatsapp_account_id,whatsapp_account_name,whatsapp_phone_number,vendor_id,vendor_name,vendor_email,started_at,ended_at,changed_by_name,change_reason')
        .eq('whatsapp_account_id', accountId!)
        .order('ended_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as HistoryRow[]).map((row) => ({
        id: row.id,
        whatsappAccountId: row.whatsapp_account_id ?? undefined,
        whatsappAccountName: row.whatsapp_account_name,
        whatsappPhoneNumber: row.whatsapp_phone_number ?? undefined,
        vendorId: row.vendor_id ?? undefined,
        vendorName: row.vendor_name,
        vendorEmail: row.vendor_email ?? undefined,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        changedByName: row.changed_by_name ?? undefined,
        changeReason: row.change_reason,
      }));
    },
  });
}

export function useRecentVendorConversations(accountIds: string[]) {
  const key = [...accountIds].sort().join(',');
  return useQuery({
    queryKey: ['vendor-recent-conversations', key],
    enabled: accountIds.length > 0,
    queryFn: async (): Promise<VendorConversationSummary[]> => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id,whatsapp_account_id,last_message_at,last_message_preview,message_count,name,contacts(name,phone)')
        .in('whatsapp_account_id', accountIds)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as unknown as ConversationRow[]).map((row) => ({
        id: row.id,
        whatsappAccountId: row.whatsapp_account_id,
        contactName: row.contacts?.name || row.name,
        contactPhone: row.contacts?.phone || '',
        lastMessageAt: row.last_message_at ?? undefined,
        lastMessagePreview: row.last_message_preview ?? '',
        messageCount: row.message_count,
      }));
    },
  });
}
