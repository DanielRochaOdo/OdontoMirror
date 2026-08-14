import { randomUUID } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import type { AuthenticatedRotasSeller } from '../rotas/authClient.js';
import { supabaseAdmin } from '../supabase/admin.js';

type VendorIdentityRow = {
  id: string;
  mirror_user_id: string | null;
  active: boolean;
};

type MirrorProfileRow = {
  id: string;
  role: string;
  active: boolean;
};

export class MirrorSellerAuthError extends Error {
  constructor(public readonly code: 'email_conflict' | 'session_issue_failed') {
    super(code);
    this.name = 'MirrorSellerAuthError';
  }
}

async function findMirrorUserByEmail(email: string): Promise<User | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Mirror/auth list users: ${error.message}`);
    const found = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
}

async function ensureMirrorAuthUser(seller: AuthenticatedRotasSeller, currentMirrorUserId: string | null) {
  if (currentMirrorUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(currentMirrorUserId);
    if (error || !data.user) throw new Error(`Mirror/auth seller ${seller.userId}: ${error?.message ?? 'usuário não encontrado'}`);
    const currentEmail = data.user.email?.trim().toLowerCase() ?? null;
    if (currentEmail !== seller.email) {
      const existingWithNewEmail = await findMirrorUserByEmail(seller.email);
      if (existingWithNewEmail && existingWithNewEmail.id !== currentMirrorUserId) {
        throw new MirrorSellerAuthError('email_conflict');
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(currentMirrorUserId, {
        email: seller.email,
        email_confirm: true,
      });
      if (updateError) throw new Error(`Mirror/auth seller email update: ${updateError.message}`);
    }
    return currentMirrorUserId;
  }

  const existingUser = await findMirrorUserByEmail(seller.email);
  if (existingUser) {
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id,role,active')
      .eq('id', existingUser.id)
      .maybeSingle();
    if (profileError) throw new Error(`Mirror/profiles email validation: ${profileError.message}`);
    const profile = existingProfile as MirrorProfileRow | null;
    if (profile?.role === 'admin') throw new MirrorSellerAuthError('email_conflict');
    return existingUser.id;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: seller.email,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: {
      source: 'odontoart-rotas',
      rotas_user_id: seller.userId,
      name: seller.name,
    },
  });
  if (createError || !created.user) {
    throw new Error(`Mirror/auth seller create: ${createError?.message ?? 'falha desconhecida'}`);
  }
  return created.user.id;
}

export async function ensureMirrorSellerIdentity(seller: AuthenticatedRotasSeller) {
  const { data: currentVendor, error: vendorLookupError } = await supabaseAdmin
    .from('commercial_vendors')
    .select('id,mirror_user_id,active')
    .eq('rotas_user_id', seller.userId)
    .maybeSingle();
  if (vendorLookupError) throw new Error(`Mirror/commercial_vendors lookup: ${vendorLookupError.message}`);

  const vendor = currentVendor as VendorIdentityRow | null;
  const mirrorUserId = await ensureMirrorAuthUser(seller, vendor?.mirror_user_id ?? null);
  const now = new Date().toISOString();

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: mirrorUserId,
    name: seller.name,
    role: 'seller',
    active: true,
    rotas_user_id: seller.userId,
    email: seller.email,
    synced_from_rotas: true,
    last_synced_at: now,
    updated_at: now,
  }, { onConflict: 'id' });
  if (profileError) throw new Error(`Mirror/profiles seller: ${profileError.message}`);

  const { error: vendorError } = await supabaseAdmin.from('commercial_vendors').upsert({
    rotas_user_id: seller.userId,
    mirror_user_id: mirrorUserId,
    name: seller.name,
    email: seller.email,
    active: true,
    supervisor_rotas_user_id: seller.supervisorUserId,
    last_synced_at: now,
    updated_at: now,
  }, { onConflict: 'rotas_user_id' });
  if (vendorError) throw new Error(`Mirror/commercial_vendors seller: ${vendorError.message}`);

  return { mirrorUserId, email: seller.email, name: seller.name };
}

export async function issueMirrorSellerLoginToken(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error) throw new Error(`Mirror/auth session bootstrap: ${error.message}`);

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) throw new MirrorSellerAuthError('session_issue_failed');

  return {
    tokenHash,
    type: 'magiclink' as const,
  };
}
