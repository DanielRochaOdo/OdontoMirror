-- Administrative ownership of corporate WhatsApp numbers.
-- This does not affect Rotas routing or commercial lead responsibility.

create table if not exists public.whatsapp_vendor_assignments (
  whatsapp_account_id uuid primary key references public.whatsapp_accounts(id) on delete cascade,
  vendor_id uuid not null references public.commercial_vendors(id) on delete cascade,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_vendor_assignments_vendor_idx
  on public.whatsapp_vendor_assignments(vendor_id);

create table if not exists public.whatsapp_vendor_assignment_history (
  id uuid primary key default gen_random_uuid(),
  whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
  whatsapp_account_name text not null,
  whatsapp_phone_number text,
  vendor_id uuid references public.commercial_vendors(id) on delete set null,
  vendor_name text not null,
  vendor_email text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  change_reason text not null default 'transfer' check (change_reason in ('transfer', 'unlink')),
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_vendor_assignment_history_account_idx
  on public.whatsapp_vendor_assignment_history(whatsapp_account_id, ended_at desc);
create index if not exists whatsapp_vendor_assignment_history_vendor_idx
  on public.whatsapp_vendor_assignment_history(vendor_id, ended_at desc);

create or replace function public.admin_assign_whatsapp_vendor(
  p_whatsapp_account_id uuid,
  p_vendor_id uuid
) returns public.whatsapp_vendor_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.whatsapp_vendor_assignments;
  v_account public.whatsapp_accounts;
  v_old_vendor public.commercial_vendors;
  v_new_vendor public.commercial_vendors;
  v_admin_name text;
  v_result public.whatsapp_vendor_assignments;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_account from public.whatsapp_accounts where id = p_whatsapp_account_id;
  if not found then raise exception 'WHATSAPP_ACCOUNT_NOT_FOUND'; end if;

  select * into v_new_vendor from public.commercial_vendors where id = p_vendor_id and active = true;
  if not found then raise exception 'ACTIVE_VENDOR_NOT_FOUND'; end if;

  select name into v_admin_name from public.profiles where id = auth.uid();
  select * into v_current from public.whatsapp_vendor_assignments where whatsapp_account_id = p_whatsapp_account_id for update;

  if found and v_current.vendor_id = p_vendor_id then
    return v_current;
  end if;

  if found then
    select * into v_old_vendor from public.commercial_vendors where id = v_current.vendor_id;
    insert into public.whatsapp_vendor_assignment_history(
      whatsapp_account_id, whatsapp_account_name, whatsapp_phone_number,
      vendor_id, vendor_name, vendor_email, started_at, ended_at,
      changed_by_profile_id, changed_by_name, change_reason
    ) values (
      v_account.id, v_account.name, v_account.phone_number,
      v_current.vendor_id, coalesce(v_old_vendor.name, 'Vendedor'), v_old_vendor.email,
      v_current.assigned_at, now(), auth.uid(), v_admin_name, 'transfer'
    );
  end if;

  insert into public.whatsapp_vendor_assignments(
    whatsapp_account_id, vendor_id, assigned_by_profile_id, assigned_at, updated_at
  ) values (
    p_whatsapp_account_id, p_vendor_id, auth.uid(), now(), now()
  )
  on conflict (whatsapp_account_id)
  do update set
    vendor_id = excluded.vendor_id,
    assigned_by_profile_id = excluded.assigned_by_profile_id,
    assigned_at = excluded.assigned_at,
    updated_at = excluded.updated_at
  returning * into v_result;

  insert into public.audit_logs(
    admin_id, action, entity_type, entity_id, whatsapp_account_id, metadata
  ) values (
    auth.uid(),
    case when v_current.whatsapp_account_id is null then 'WHATSAPP_VENDOR_ASSIGNED' else 'WHATSAPP_VENDOR_TRANSFERRED' end,
    'whatsapp_vendor_assignment',
    p_whatsapp_account_id,
    p_whatsapp_account_id,
    jsonb_build_object(
      'entity_label', v_account.name,
      'vendor_id', v_new_vendor.id,
      'vendor_name', v_new_vendor.name,
      'vendor_email', v_new_vendor.email,
      'previous_vendor_id', v_current.vendor_id
    )
  );

  return v_result;
end;
$$;

create or replace function public.admin_unlink_whatsapp_vendor(
  p_whatsapp_account_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.whatsapp_vendor_assignments;
  v_account public.whatsapp_accounts;
  v_vendor public.commercial_vendors;
  v_admin_name text;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_current from public.whatsapp_vendor_assignments where whatsapp_account_id = p_whatsapp_account_id for update;
  if not found then return false; end if;

  select * into v_account from public.whatsapp_accounts where id = p_whatsapp_account_id;
  select * into v_vendor from public.commercial_vendors where id = v_current.vendor_id;
  select name into v_admin_name from public.profiles where id = auth.uid();

  insert into public.whatsapp_vendor_assignment_history(
    whatsapp_account_id, whatsapp_account_name, whatsapp_phone_number,
    vendor_id, vendor_name, vendor_email, started_at, ended_at,
    changed_by_profile_id, changed_by_name, change_reason
  ) values (
    v_account.id, coalesce(v_account.name, 'WhatsApp corporativo'), v_account.phone_number,
    v_current.vendor_id, coalesce(v_vendor.name, 'Vendedor'), v_vendor.email,
    v_current.assigned_at, now(), auth.uid(), v_admin_name, 'unlink'
  );

  delete from public.whatsapp_vendor_assignments where whatsapp_account_id = p_whatsapp_account_id;

  insert into public.audit_logs(
    admin_id, action, entity_type, entity_id, whatsapp_account_id, metadata
  ) values (
    auth.uid(), 'WHATSAPP_VENDOR_UNLINKED', 'whatsapp_vendor_assignment',
    p_whatsapp_account_id, p_whatsapp_account_id,
    jsonb_build_object(
      'entity_label', coalesce(v_account.name, 'WhatsApp corporativo'),
      'vendor_id', v_current.vendor_id,
      'vendor_name', v_vendor.name,
      'vendor_email', v_vendor.email
    )
  );

  return true;
end;
$$;

alter table public.whatsapp_vendor_assignments enable row level security;
alter table public.whatsapp_vendor_assignment_history enable row level security;

create policy "admins read whatsapp vendor assignments"
  on public.whatsapp_vendor_assignments for select
  using (public.is_active_admin());
create policy "admins read whatsapp vendor assignment history"
  on public.whatsapp_vendor_assignment_history for select
  using (public.is_active_admin());

grant select on public.whatsapp_vendor_assignments to authenticated;
grant select on public.whatsapp_vendor_assignment_history to authenticated;
grant execute on function public.admin_assign_whatsapp_vendor(uuid, uuid) to authenticated;
grant execute on function public.admin_unlink_whatsapp_vendor(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'whatsapp_vendor_assignments'
  ) then
    alter publication supabase_realtime add table public.whatsapp_vendor_assignments;
  end if;
end $$;
