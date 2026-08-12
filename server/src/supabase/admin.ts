import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/** Backend-only client. Never import this module from apps/web. */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
