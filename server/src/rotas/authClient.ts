import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export type AuthenticatedRotasSeller = {
  userId: string;
  email: string;
  name: string;
  supervisorUserId: string | null;
};

type RotasSellerProfile = {
  user_id: string | null;
  role: string | null;
  display_name: string | null;
  nome: string | null;
  supervisor_id: string | null;
  is_inactive: boolean | null;
};

export class RotasSellerAuthError extends Error {
  constructor(public readonly code: 'invalid_credentials' | 'access_denied' | 'not_configured') {
    super(code);
    this.name = 'RotasSellerAuthError';
  }
}

function requireRotasAuthConfig() {
  if (!env.ROTAS_SUPABASE_URL || !env.ROTAS_SUPABASE_ANON_KEY || !env.ROTAS_SUPABASE_SERVICE_ROLE_KEY) {
    throw new RotasSellerAuthError('not_configured');
  }
  return {
    url: env.ROTAS_SUPABASE_URL,
    anonKey: env.ROTAS_SUPABASE_ANON_KEY,
    serviceRoleKey: env.ROTAS_SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function isRotasSellerAuthConfigured() {
  return Boolean(env.ROTAS_SUPABASE_URL && env.ROTAS_SUPABASE_ANON_KEY && env.ROTAS_SUPABASE_SERVICE_ROLE_KEY);
}

export async function authenticateRotasSeller(email: string, password: string): Promise<AuthenticatedRotasSeller> {
  const config = requireRotasAuthConfig();
  const authClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (authError || !authData.user) {
    throw new RotasSellerAuthError('invalid_credentials');
  }

  const rotasAdmin = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: profileData, error: profileError } = await rotasAdmin
    .from('profiles')
    .select('user_id,role,display_name,nome,supervisor_id,is_inactive')
    .eq('user_id', authData.user.id)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Rotas/profiles auth validation: ${profileError.message}`);
  }

  const profile = profileData as RotasSellerProfile | null;
  if (!profile || profile.role !== 'VENDEDOR' || profile.is_inactive === true) {
    throw new RotasSellerAuthError('access_denied');
  }

  const resolvedEmail = authData.user.email?.trim().toLowerCase();
  if (!resolvedEmail) {
    throw new RotasSellerAuthError('access_denied');
  }

  return {
    userId: authData.user.id,
    email: resolvedEmail,
    name: profile.display_name?.trim() || profile.nome?.trim() || resolvedEmail,
    supervisorUserId: profile.supervisor_id,
  };
}
