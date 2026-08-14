-- Commercial post-visit journey for MirrorDesk.
-- Rotas remains the source of truth for companies, visits and vendor direction.
-- Mirror owns lead enrichment, kanban stages, assignment history and derived metrics.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'seller'));

alter table public.profiles
  add column if not exists rotas_user_id uuid,
  add column if not exists email text,
  add column if not exists synced_from_rotas boolean not null default false,
  add column if not exists last_synced_at timestamptz;

create unique index if not exists profiles_rotas_user_uidx
  on public.profiles(rotas_user_id)
  where rotas_user_id is not null;

create or replace function public.normalize_br_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_digits := regexp_replace(v_digits, '^0+', '');
  if length(v_digits) in (10, 11) then return '55' || v_digits; end if;
  if length(v_digits) in (12, 13) and left(v_digits, 2) = '55' then return v_digits; end if;
  return nullif(v_digits, '');
end;
$$;

alter table public.contacts add column if not exists phone_normalized text;
update public.contacts
set phone_normalized = public.normalize_br_phone(phone)
where phone_normalized is distinct from public.normalize_br_phone(phone);
create index if not exists contacts_phone_normalized_idx on public.contacts(phone_normalized);

create or replace function public.sync_contact_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_br_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists contacts_normalize_phone_trg on public.contacts;
create trigger contacts_normalize_phone_trg
before insert or update of phone on public.contacts
for each row execute function public.sync_contact_phone_normalized();

create table if not exists public.commercial_vendors (
  id uuid primary key default gen_random_uuid(),
  rotas_user_id uuid not null unique,
  mirror_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text,
  active boolean not null default true,
  supervisor_rotas_user_id uuid,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists commercial_vendors_email_uidx
  on public.commercial_vendors(lower(email)) where email is not null;
create index if not exists commercial_vendors_active_idx on public.commercial_vendors(active);

create table if not exists public.commercial_companies (
  id uuid primary key default gen_random_uuid(),
  rotas_cliente_id uuid not null unique,
  company_code text,
  company_name text not null,
  trade_name text,
  contact_name text,
  contact_raw text,
  status text,
  category text,
  group_name text,
  city text,
  district text,
  uf text,
  last_visit_at date,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_companies_code_idx on public.commercial_companies(company_code);
create index if not exists commercial_companies_name_idx on public.commercial_companies(company_name);

create table if not exists public.commercial_company_phones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.commercial_companies(id) on delete cascade,
  phone_normalized text not null,
  contact_name text,
  source text not null default 'rotas' check (source in ('rotas', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, phone_normalized)
);
create index if not exists commercial_company_phones_phone_idx on public.commercial_company_phones(phone_normalized);

create table if not exists public.commercial_visits (
  id uuid primary key default gen_random_uuid(),
  rotas_visit_id uuid not null unique,
  company_id uuid not null references public.commercial_companies(id) on delete cascade,
  visit_date date not null,
  rotas_route_id uuid,
  vendor_rotas_user_id uuid,
  vendor_name text,
  completed_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_visits_company_date_idx on public.commercial_visits(company_id, visit_date desc);
create index if not exists commercial_visits_vendor_date_idx on public.commercial_visits(vendor_rotas_user_id, visit_date desc);

create table if not exists public.commercial_kanban_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  position integer not null check (position >= 0),
  color_key text not null default 'neutral',
  active boolean not null default true,
  is_terminal boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_kanban_statuses_position_idx on public.commercial_kanban_statuses(position, created_at);

insert into public.commercial_kanban_statuses(name, slug, position, color_key, active, is_terminal)
values
  ('Pós-visita', 'pos-visita', 10, 'slate', true, false),
  ('Contato realizado', 'contato-realizado', 20, 'blue', true, false),
  ('Em conversa', 'em-conversa', 30, 'cyan', true, false),
  ('Aguardando cliente', 'aguardando-cliente', 40, 'amber', true, false),
  ('Negociação', 'negociacao', 50, 'violet', true, false),
  ('Convertido', 'convertido', 60, 'green', true, true),
  ('Sem resposta', 'sem-resposta', 70, 'orange', true, true),
  ('Sem interesse', 'sem-interesse', 80, 'gray', true, true),
  ('Perdido', 'perdido', 90, 'red', true, true)
on conflict (slug) do nothing;

create table if not exists public.commercial_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.commercial_companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null,
  display_name text not null,
  department text,
  contact_name text,
  contact_phone text,
  linked_phone_normalized text,
  status_id uuid not null references public.commercial_kanban_statuses(id),
  link_source text not null default 'automatic' check (link_source in ('automatic', 'manual')),
  archived boolean not null default false,
  first_linked_at timestamptz not null default now(),
  last_status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_leads_company_idx on public.commercial_leads(company_id);
create index if not exists commercial_leads_status_idx on public.commercial_leads(status_id, archived);
create index if not exists commercial_leads_phone_idx on public.commercial_leads(linked_phone_normalized);

create table if not exists public.commercial_lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.commercial_leads(id) on delete cascade,
  vendor_id uuid not null references public.commercial_vendors(id) on delete cascade,
  source text not null default 'route' check (source in ('route', 'manual')),
  source_visit_date date,
  source_visit_ids uuid[] not null default '{}'::uuid[],
  active boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists commercial_lead_assignments_active_uidx
  on public.commercial_lead_assignments(lead_id, vendor_id) where active = true;
create index if not exists commercial_lead_assignments_vendor_idx on public.commercial_lead_assignments(vendor_id, active);
create index if not exists commercial_lead_assignments_lead_idx on public.commercial_lead_assignments(lead_id, active);

create table if not exists public.commercial_lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.commercial_leads(id) on delete cascade,
  from_status_id uuid references public.commercial_kanban_statuses(id) on delete set null,
  to_status_id uuid not null references public.commercial_kanban_statuses(id),
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  changed_by_role text,
  created_at timestamptz not null default now()
);
create index if not exists commercial_lead_status_history_lead_idx on public.commercial_lead_status_history(lead_id, created_at desc);

create table if not exists public.commercial_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.commercial_leads(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  note text not null check (length(trim(note)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists commercial_lead_notes_lead_idx on public.commercial_lead_notes(lead_id, created_at desc);

create table if not exists public.commercial_lead_metrics (
  lead_id uuid primary key references public.commercial_leads(id) on delete cascade,
  last_visit_at timestamptz,
  first_interaction_after_visit_at timestamptz,
  last_interaction_at timestamptz,
  interaction_count_after_visit integer not null default 0,
  inbound_count_after_visit integer not null default 0,
  outbound_count_after_visit integer not null default 0,
  followup_delay_minutes integer,
  days_without_interaction integer,
  no_followup boolean not null default false,
  temperature text not null default 'unknown' check (temperature in ('hot','warm','cold','stopped','unknown')),
  updated_at timestamptz not null default now()
);

create table if not exists public.commercial_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running','success','error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  vendors_synced integer not null default 0,
  companies_synced integer not null default 0,
  visits_synced integer not null default 0,
  leads_linked integer not null default 0,
  assignments_changed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists commercial_sync_runs_started_idx on public.commercial_sync_runs(started_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
  trigger_name text;
begin
  foreach t in array array[
    'commercial_vendors',
    'commercial_companies',
    'commercial_company_phones',
    'commercial_visits',
    'commercial_kanban_statuses',
    'commercial_leads',
    'commercial_lead_assignments'
  ] loop
    trigger_name := t || '_set_updated_at';
    execute format('drop trigger if exists %I on public.%I', trigger_name, t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_row_updated_at()', trigger_name, t);
  end loop;
end $$;

create or replace function public.is_active_seller()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'seller' and p.active = true and p.rotas_user_id is not null
  );
$$;

create or replace function public.is_commercial_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_admin() or public.is_active_seller();
$$;

create or replace function public.can_access_commercial_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_admin() or exists (
    select 1
    from public.commercial_lead_assignments a
    join public.commercial_vendors v on v.id = a.vendor_id
    where a.lead_id = p_lead_id and a.active = true and v.active = true and v.mirror_user_id = auth.uid()
  );
$$;

create or replace function public.move_commercial_lead(p_lead_id uuid, p_status_id uuid)
returns public.commercial_leads
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.commercial_leads;
  v_role text;
begin
  if not public.can_access_commercial_lead(p_lead_id) then raise exception 'COMMERCIAL_LEAD_ACCESS_DENIED'; end if;
  if not exists (select 1 from public.commercial_kanban_statuses where id = p_status_id and active = true) then
    raise exception 'INVALID_KANBAN_STATUS';
  end if;
  select * into v_lead from public.commercial_leads where id = p_lead_id for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  if v_lead.status_id = p_status_id then return v_lead; end if;
  select role into v_role from public.profiles where id = auth.uid();
  insert into public.commercial_lead_status_history(lead_id, from_status_id, to_status_id, changed_by_profile_id, changed_by_role)
  values (p_lead_id, v_lead.status_id, p_status_id, auth.uid(), v_role);
  update public.commercial_leads
  set status_id = p_status_id, last_status_changed_at = now(), updated_at = now()
  where id = p_lead_id returning * into v_lead;
  return v_lead;
end;
$$;

create or replace function public.update_commercial_lead_identity(p_lead_id uuid, p_display_name text, p_department text default null)
returns public.commercial_leads
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.commercial_leads;
begin
  if not public.can_access_commercial_lead(p_lead_id) then raise exception 'COMMERCIAL_LEAD_ACCESS_DENIED'; end if;
  if length(trim(coalesce(p_display_name, ''))) < 2 then raise exception 'INVALID_LEAD_NAME'; end if;
  update public.commercial_leads
  set display_name = trim(p_display_name), department = nullif(trim(coalesce(p_department, '')), ''), updated_at = now()
  where id = p_lead_id returning * into v_lead;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  return v_lead;
end;
$$;

create or replace function public.add_commercial_lead_note(p_lead_id uuid, p_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_access_commercial_lead(p_lead_id) then raise exception 'COMMERCIAL_LEAD_ACCESS_DENIED'; end if;
  if length(trim(coalesce(p_note, ''))) = 0 then raise exception 'INVALID_NOTE'; end if;
  insert into public.commercial_lead_notes(lead_id, author_profile_id, note)
  values (p_lead_id, auth.uid(), trim(p_note)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_relink_commercial_lead(p_lead_id uuid, p_company_id uuid)
returns public.commercial_leads
language plpgsql security definer set search_path = public
as $$
declare
  v_lead public.commercial_leads;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.commercial_companies where id = p_company_id) then raise exception 'COMPANY_NOT_FOUND'; end if;
  update public.commercial_leads set company_id = p_company_id, link_source = 'manual', updated_at = now()
  where id = p_lead_id returning * into v_lead;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  return v_lead;
end;
$$;

grant execute on function public.move_commercial_lead(uuid, uuid) to authenticated;
grant execute on function public.update_commercial_lead_identity(uuid, text, text) to authenticated;
grant execute on function public.add_commercial_lead_note(uuid, text) to authenticated;
grant execute on function public.admin_relink_commercial_lead(uuid, uuid) to authenticated;

alter table public.commercial_vendors enable row level security;
alter table public.commercial_companies enable row level security;
alter table public.commercial_company_phones enable row level security;
alter table public.commercial_visits enable row level security;
alter table public.commercial_kanban_statuses enable row level security;
alter table public.commercial_leads enable row level security;
alter table public.commercial_lead_assignments enable row level security;
alter table public.commercial_lead_status_history enable row level security;
alter table public.commercial_lead_notes enable row level security;
alter table public.commercial_lead_metrics enable row level security;
alter table public.commercial_sync_runs enable row level security;

create policy "users read own active profile" on public.profiles for select
  using (id = auth.uid() and active = true);

create policy "commercial users read kanban statuses" on public.commercial_kanban_statuses for select
  using (public.is_commercial_user());
create policy "admins insert kanban statuses" on public.commercial_kanban_statuses for insert
  with check (public.is_active_admin());
create policy "admins update kanban statuses" on public.commercial_kanban_statuses for update
  using (public.is_active_admin()) with check (public.is_active_admin());
create policy "admins delete kanban statuses" on public.commercial_kanban_statuses for delete
  using (public.is_active_admin());

create policy "commercial users read visible vendors" on public.commercial_vendors for select
  using (public.is_commercial_user() and (active = true or public.is_active_admin()));

create policy "admins read commercial companies" on public.commercial_companies for select
  using (public.is_active_admin());
create policy "sellers read assigned commercial companies" on public.commercial_companies for select
  using (public.is_active_seller() and exists (
    select 1 from public.commercial_leads l
    where l.company_id = commercial_companies.id and public.can_access_commercial_lead(l.id)
  ));

create policy "admins read company phones" on public.commercial_company_phones for select
  using (public.is_active_admin());
create policy "admins read commercial visits" on public.commercial_visits for select
  using (public.is_active_admin());
create policy "sellers read visits for assigned companies" on public.commercial_visits for select
  using (public.is_active_seller() and exists (
    select 1 from public.commercial_leads l
    where l.company_id = commercial_visits.company_id and public.can_access_commercial_lead(l.id)
  ));

create policy "commercial users read accessible leads" on public.commercial_leads for select
  using (public.can_access_commercial_lead(id));
create policy "admins update commercial leads" on public.commercial_leads for update
  using (public.is_active_admin()) with check (public.is_active_admin());
create policy "commercial users read accessible assignments" on public.commercial_lead_assignments for select
  using (public.can_access_commercial_lead(lead_id));
create policy "commercial users read accessible status history" on public.commercial_lead_status_history for select
  using (public.can_access_commercial_lead(lead_id));
create policy "commercial users read accessible notes" on public.commercial_lead_notes for select
  using (public.can_access_commercial_lead(lead_id));
create policy "commercial users read accessible metrics" on public.commercial_lead_metrics for select
  using (public.can_access_commercial_lead(lead_id));
create policy "admins read commercial sync runs" on public.commercial_sync_runs for select
  using (public.is_active_admin());

grant select on public.commercial_vendors to authenticated;
grant select on public.commercial_companies to authenticated;
grant select on public.commercial_company_phones to authenticated;
grant select on public.commercial_visits to authenticated;
grant select, insert, update, delete on public.commercial_kanban_statuses to authenticated;
grant select, update on public.commercial_leads to authenticated;
grant select on public.commercial_lead_assignments to authenticated;
grant select on public.commercial_lead_status_history to authenticated;
grant select on public.commercial_lead_notes to authenticated;
grant select on public.commercial_lead_metrics to authenticated;
grant select on public.commercial_sync_runs to authenticated;

-- Sellers intentionally receive no policies on WhatsApp accounts, contacts,
-- conversations, messages, media or audit logs.
do $$
declare
  t text;
begin
  foreach t in array array[
    'commercial_kanban_statuses',
    'commercial_leads',
    'commercial_lead_assignments',
    'commercial_lead_metrics'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
