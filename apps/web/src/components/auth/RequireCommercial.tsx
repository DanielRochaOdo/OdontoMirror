import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AppLayout } from '../layout/AppLayout';

export function RequireCommercial({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return active && setState('denied');
      const { data } = await supabase.from('profiles').select('role,active').eq('id', session.user.id).maybeSingle();
      if (!active) return;
      if ((data?.role === 'admin' || data?.role === 'seller') && data.active === true) setState('allowed');
      else {
        await supabase.auth.signOut();
        if (active) setState('denied');
      }
    };
    void check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void check(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (state === 'loading') return <div className="login-shell"><main className="login-card-wrap"><div className="login-card"><p>Validando acesso comercial...</p></div></main></div>;
  if (state === 'denied') return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}
