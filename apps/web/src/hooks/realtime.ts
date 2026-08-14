import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refreshCommercial = () => {
      void queryClient.invalidateQueries({ queryKey: ['commercial-leads'] });
      void queryClient.invalidateQueries({ queryKey: ['commercial-kanban-statuses'] });
      void queryClient.invalidateQueries({ queryKey: ['commercial-vendors'] });
    };
    const leadIdFrom = (record: unknown) => typeof record === 'object' && record !== null && 'lead_id' in record ? String(record.lead_id) : null;

    const channel = supabase
      .channel('mirror-desk-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_accounts' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-account'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['conversation'] });
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['messages'] });
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_kanban_statuses' }, refreshCommercial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_leads' }, (payload) => {
        refreshCommercial();
        const leadId = typeof payload.new === 'object' && payload.new && 'id' in payload.new ? String(payload.new.id) : null;
        if (leadId) void queryClient.invalidateQueries({ queryKey: ['commercial-lead-history', leadId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_lead_assignments' }, refreshCommercial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_lead_assignment_history' }, refreshCommercial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_lead_metrics' }, refreshCommercial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_lead_status_history' }, (payload) => {
        const leadId = leadIdFrom(payload.new) ?? leadIdFrom(payload.old);
        if (leadId) void queryClient.invalidateQueries({ queryKey: ['commercial-lead-history', leadId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_lead_notes' }, (payload) => {
        const leadId = leadIdFrom(payload.new) ?? leadIdFrom(payload.old);
        if (leadId) void queryClient.invalidateQueries({ queryKey: ['commercial-lead-notes', leadId] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
}
