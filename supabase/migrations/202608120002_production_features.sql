-- Completa o MVP com suporte a sessão idempotente, perfil editável,
-- auditoria segura e Realtime nas tabelas observadas pelo frontend.

create unique index if not exists whatsapp_sessions_account_uidx
  on public.whatsapp_sessions(whatsapp_account_id);

create policy "admins update own profile"
  on public.profiles for update
  using (id = auth.uid() and public.is_active_admin())
  with check (id = auth.uid() and role = 'admin' and active = true);

create or replace function public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_whatsapp_account_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if length(trim(coalesce(p_action, ''))) = 0 or length(trim(coalesce(p_entity_type, ''))) = 0 then
    raise exception 'INVALID_AUDIT_EVENT';
  end if;
  insert into public.audit_logs(admin_id, action, entity_type, entity_id, whatsapp_account_id, user_agent, metadata)
  values (auth.uid(), upper(trim(p_action)), trim(p_entity_type), p_entity_id, p_whatsapp_account_id, p_metadata->>'user_agent', p_metadata - 'user_agent')
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_audit_event(text, text, uuid, uuid, jsonb) to authenticated;

-- Habilita as tabelas usadas pelo painel em Realtime sem falhar se já estiverem publicadas.
do $$
declare
  t text;
begin
  foreach t in array array['whatsapp_accounts', 'conversations', 'messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
