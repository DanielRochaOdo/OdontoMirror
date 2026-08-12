import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
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
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
}
