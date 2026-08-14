create or replace function public.set_commercial_lead_post_visit_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.link_source = 'automatic' then
    new.archived := not exists (
      select 1
      from public.commercial_visits v
      where v.company_id = new.company_id
        and v.completed_at is not null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_lead_post_visit_visibility_trg on public.commercial_leads;
create trigger commercial_lead_post_visit_visibility_trg
before insert on public.commercial_leads
for each row execute function public.set_commercial_lead_post_visit_visibility();

create or replace function public.activate_commercial_leads_after_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null and (old.completed_at is null or old.completed_at is distinct from new.completed_at) then
    update public.commercial_leads
    set archived = false, updated_at = now()
    where company_id = new.company_id
      and link_source = 'automatic'
      and archived = true;
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_visit_activate_leads_trg on public.commercial_visits;
create trigger commercial_visit_activate_leads_trg
after update of completed_at on public.commercial_visits
for each row execute function public.activate_commercial_leads_after_visit();

create or replace function public.activate_commercial_leads_after_new_completed_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null then
    update public.commercial_leads
    set archived = false, updated_at = now()
    where company_id = new.company_id
      and link_source = 'automatic'
      and archived = true;
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_new_visit_activate_leads_trg on public.commercial_visits;
create trigger commercial_new_visit_activate_leads_trg
after insert on public.commercial_visits
for each row execute function public.activate_commercial_leads_after_new_completed_visit();
