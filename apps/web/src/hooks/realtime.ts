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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_lead_metrics' }, refreshCommercial)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
}
