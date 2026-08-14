create table if not exists public.commercial_lead_assignment_history (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  lead_id uuid not null references public.commercial_leads(id) on delete cascade,
  vendor_id uuid references public.commercial_vendors(id) on delete set null,
  vendor_name text not null,
  vendor_email text,
  source text not null,
  source_visit_date date,
  source_visit_ids uuid[] not null default '{}'::uuid[],
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists commercial_lead_assignment_history_lead_idx
  on public.commercial_lead_assignment_history(lead_id, ended_at desc);
create index if not exists commercial_lead_assignment_history_vendor_idx
  on public.commercial_lead_assignment_history(vendor_id, ended_at desc);

create or replace function public.archive_ended_commercial_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_name text;
  v_vendor_email text;
begin
  if old.active = true and new.active = false then
    select name, email into v_vendor_name, v_vendor_email
    from public.commercial_vendors
    where id = new.vendor_id;

    insert into public.commercial_lead_assignment_history(
      assignment_id,
      lead_id,
      vendor_id,
      vendor_name,
      vendor_email,
      source,
      source_visit_date,
      source_visit_ids,
      started_at,
      ended_at
    ) values (
      new.id,
      new.lead_id,
      new.vendor_id,
      coalesce(v_vendor_name, 'Vendedor'),
      v_vendor_email,
      new.source,
      new.source_visit_date,
      new.source_visit_ids,
      new.started_at,
      coalesce(new.ended_at, now())
    );

    delete from public.commercial_lead_assignments where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists commercial_assignment_archive_trg on public.commercial_lead_assignments;
create trigger commercial_assignment_archive_trg
after update of active on public.commercial_lead_assignments
for each row
when (old.active = true and new.active = false)
execute function public.archive_ended_commercial_assignment();

alter table public.commercial_lead_assignment_history enable row level security;
create policy "commercial users read accessible assignment history"
  on public.commercial_lead_assignment_history for select
  using (public.can_access_commercial_lead(lead_id));

grant select on public.commercial_lead_assignment_history to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'commercial_lead_assignment_history'
  ) then
    alter publication supabase_realtime add table public.commercial_lead_assignment_history;
  end if;
end $$;
