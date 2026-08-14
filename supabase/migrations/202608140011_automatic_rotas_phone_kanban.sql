-- Rotas is the source of truth for company phones used by the commercial Kanban.
-- A normal commercial flow must not depend on an administrator manually linking a WhatsApp contact to a company.
-- Automatic flow:
--   Rotas company phone -> completed/synchronized visit -> automatic lead identity ->
--   WhatsApp messages to/from the same phone refresh the commercial metrics immediately.
-- Manual links remain an explicit administrative override and are never modified by these functions.

create or replace function public.ensure_automatic_commercial_lead_for_company_phone(
  p_company_id uuid,
  p_phone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_company public.commercial_companies;
  v_status_id uuid;
  v_contact public.contacts;
  v_existing public.commercial_leads;
  v_lead_id uuid;
begin
  v_phone := public.normalize_br_phone(p_phone);
  if v_phone is null then return null; end if;

  select * into v_company
  from public.commercial_companies
  where id = p_company_id;
  if not found then return null; end if;

  select id into v_status_id
  from public.commercial_kanban_statuses
  where slug = 'pos-visita'
  limit 1;
  if v_status_id is null then
    raise exception 'Status inicial pos-visita não encontrado';
  end if;

  select * into v_contact
  from public.contacts
  where coalesce(phone_normalized, public.normalize_br_phone(phone)) = v_phone
  order by updated_at desc, created_at desc
  limit 1;

  select * into v_existing
  from public.commercial_leads
  where company_id = p_company_id
    and linked_phone_normalized = v_phone
  limit 1;

  if found then
    -- The administrator's manual correction always wins.
    if v_existing.link_source = 'automatic' and v_contact.id is not null then
      update public.commercial_leads
      set contact_id = v_contact.id,
          whatsapp_account_id = v_contact.whatsapp_account_id,
          contact_name = coalesce(v_company.contact_name, v_contact.name, contact_name),
          contact_phone = coalesce(v_contact.phone, contact_phone, v_phone),
          updated_at = now()
      where id = v_existing.id;
    end if;
    return v_existing.id;
  end if;

  begin
    insert into public.commercial_leads(
      company_id,
      contact_id,
      whatsapp_account_id,
      display_name,
      department,
      contact_name,
      contact_phone,
      linked_phone_normalized,
      status_id,
      link_source
    ) values (
      p_company_id,
      v_contact.id,
      v_contact.whatsapp_account_id,
      v_company.company_name,
      null,
      coalesce(v_company.contact_name, v_contact.name),
      coalesce(v_contact.phone, v_phone),
      v_phone,
      v_status_id,
      'automatic'
    ) returning id into v_lead_id;
  exception when unique_violation then
    select id into v_lead_id
    from public.commercial_leads
    where company_id = p_company_id
      and linked_phone_normalized = v_phone
    limit 1;
  end;

  return v_lead_id;
end;
$$;

create or replace function public.reconcile_automatic_commercial_leads_for_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_company_count integer;
  v_company_id uuid;
  v_lead_id uuid;
begin
  v_phone := public.normalize_br_phone(p_phone);
  if v_phone is null then return; end if;

  select count(distinct company_id)::integer
  into v_company_count
  from public.commercial_company_phones
  where source = 'rotas'
    and phone_normalized = v_phone;

  if v_company_count = 1 then
    select company_id
    into v_company_id
    from public.commercial_company_phones
    where source = 'rotas'
      and phone_normalized = v_phone
    limit 1;
  end if;

  if v_company_count = 1 and v_company_id is not null then
    v_lead_id := public.ensure_automatic_commercial_lead_for_company_phone(v_company_id, v_phone);

    if v_lead_id is not null then
      update public.commercial_leads l
      set archived = not exists (
        select 1
        from public.commercial_visits v
        where v.company_id = l.company_id
          and v.completed_at is not null
      ),
      updated_at = now()
      where l.id = v_lead_id
        and l.link_source = 'automatic';
    end if;
  else
    -- Zero or multiple Rotas companies with the same phone is not safe for automatic identification.
    -- Keep history, but hide automatic cards until the source becomes unambiguous.
    update public.commercial_leads
    set archived = true,
        updated_at = now()
    where link_source = 'automatic'
      and linked_phone_normalized = v_phone
      and archived = false;
  end if;
end;
$$;

create or replace function public.refresh_commercial_lead_metrics_for_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_lead record;
  v_last_visit_at timestamptz;
  v_first_after_visit timestamptz;
  v_last_interaction timestamptz;
  v_interaction_count integer;
  v_inbound_count integer;
  v_outbound_count integer;
  v_followup_delay integer;
  v_days_without_interaction integer;
  v_temperature text;
begin
  v_phone := public.normalize_br_phone(p_phone);
  if v_phone is null then return; end if;

  for v_lead in
    select id, company_id
    from public.commercial_leads
    where linked_phone_normalized = v_phone
  loop
    select max(completed_at)
    into v_last_visit_at
    from public.commercial_visits
    where company_id = v_lead.company_id
      and completed_at is not null;

    select max(m.sent_at)
    into v_last_interaction
    from public.messages m
    join public.conversations cv on cv.id = m.conversation_id
    join public.contacts ct on ct.id = cv.contact_id
    where coalesce(ct.phone_normalized, public.normalize_br_phone(ct.phone)) = v_phone;

    v_first_after_visit := null;
    v_interaction_count := 0;
    v_inbound_count := 0;
    v_outbound_count := 0;

    if v_last_visit_at is not null then
      select
        min(m.sent_at),
        count(*)::integer,
        count(*) filter (where m.direction = 'inbound')::integer,
        count(*) filter (where m.direction = 'outbound')::integer
      into
        v_first_after_visit,
        v_interaction_count,
        v_inbound_count,
        v_outbound_count
      from public.messages m
      join public.conversations cv on cv.id = m.conversation_id
      join public.contacts ct on ct.id = cv.contact_id
      where coalesce(ct.phone_normalized, public.normalize_br_phone(ct.phone)) = v_phone
        and m.sent_at >= v_last_visit_at;
    end if;

    if v_last_visit_at is not null and v_first_after_visit is not null then
      v_followup_delay := greatest(0, round(extract(epoch from (v_first_after_visit - v_last_visit_at)) / 60.0)::integer);
    else
      v_followup_delay := null;
    end if;

    if v_last_interaction is not null then
      v_days_without_interaction := greatest(0, floor(extract(epoch from (now() - v_last_interaction)) / 86400.0)::integer);
      v_temperature := case
        when v_days_without_interaction <= 2 then 'hot'
        when v_days_without_interaction <= 5 then 'warm'
        when v_days_without_interaction <= 10 then 'cold'
        else 'stopped'
      end;
    else
      v_days_without_interaction := null;
      v_temperature := 'unknown';
    end if;

    insert into public.commercial_lead_metrics(
      lead_id,
      last_visit_at,
      first_interaction_after_visit_at,
      last_interaction_at,
      interaction_count_after_visit,
      inbound_count_after_visit,
      outbound_count_after_visit,
      followup_delay_minutes,
      days_without_interaction,
      no_followup,
      temperature,
      updated_at
    ) values (
      v_lead.id,
      v_last_visit_at,
      v_first_after_visit,
      v_last_interaction,
      coalesce(v_interaction_count, 0),
      coalesce(v_inbound_count, 0),
      coalesce(v_outbound_count, 0),
      v_followup_delay,
      v_days_without_interaction,
      (v_last_visit_at is not null and coalesce(v_interaction_count, 0) = 0),
      v_temperature,
      now()
    )
    on conflict (lead_id) do update set
      last_visit_at = excluded.last_visit_at,
      first_interaction_after_visit_at = excluded.first_interaction_after_visit_at,
      last_interaction_at = excluded.last_interaction_at,
      interaction_count_after_visit = excluded.interaction_count_after_visit,
      inbound_count_after_visit = excluded.inbound_count_after_visit,
      outbound_count_after_visit = excluded.outbound_count_after_visit,
      followup_delay_minutes = excluded.followup_delay_minutes,
      days_without_interaction = excluded.days_without_interaction,
      no_followup = excluded.no_followup,
      temperature = excluded.temperature,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

create or replace function public.refresh_commercial_metrics_after_message_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  select coalesce(ct.phone_normalized, public.normalize_br_phone(ct.phone))
  into v_phone
  from public.conversations cv
  join public.contacts ct on ct.id = cv.contact_id
  where cv.id = new.conversation_id;

  if v_phone is not null then
    -- If this phone is present in exactly one Rotas company, the lead is created/attached automatically.
    perform public.reconcile_automatic_commercial_leads_for_phone(v_phone);
    perform public.refresh_commercial_lead_metrics_for_phone(v_phone);
  end if;

  return new;
end;
$$;

drop trigger if exists messages_refresh_commercial_metrics_trg on public.messages;
create trigger messages_refresh_commercial_metrics_trg
after insert on public.messages
for each row execute function public.refresh_commercial_metrics_after_message_trg();

create or replace function public.reconcile_company_kanban_after_visit_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone record;
begin
  -- Phone identities that no longer belong to this company in Rotas remain in history,
  -- but must not stay visible as automatic current cards.
  update public.commercial_leads l
  set archived = true,
      updated_at = now()
  where l.company_id = new.company_id
    and l.link_source = 'automatic'
    and l.archived = false
    and not exists (
      select 1
      from public.commercial_company_phones cp
      where cp.source = 'rotas'
        and cp.company_id = new.company_id
        and cp.phone_normalized = l.linked_phone_normalized
    );

  for v_phone in
    select distinct cp.phone_normalized
    from public.commercial_company_phones cp
    where cp.source = 'rotas'
      and cp.company_id = new.company_id
  loop
    perform public.reconcile_automatic_commercial_leads_for_phone(v_phone.phone_normalized);
    perform public.refresh_commercial_lead_metrics_for_phone(v_phone.phone_normalized);
  end loop;

  return new;
end;
$$;

drop trigger if exists commercial_visits_reconcile_automatic_kanban_trg on public.commercial_visits;
create trigger commercial_visits_reconcile_automatic_kanban_trg
after insert or update on public.commercial_visits
for each row execute function public.reconcile_company_kanban_after_visit_trg();

-- Backfill existing mirrored visits/phones immediately when this migration is applied.
do $$
declare
  r record;
begin
  for r in
    select distinct cp.phone_normalized
    from public.commercial_company_phones cp
    where cp.source = 'rotas'
  loop
    perform public.reconcile_automatic_commercial_leads_for_phone(r.phone_normalized);
    perform public.refresh_commercial_lead_metrics_for_phone(r.phone_normalized);
  end loop;
end;
$$;

-- These helpers are internal. Browser roles must not invoke them directly.
revoke execute on function public.ensure_automatic_commercial_lead_for_company_phone(uuid, text) from public, anon, authenticated;
revoke execute on function public.reconcile_automatic_commercial_leads_for_phone(text) from public, anon, authenticated;
revoke execute on function public.refresh_commercial_lead_metrics_for_phone(text) from public, anon, authenticated;
revoke execute on function public.refresh_commercial_metrics_after_message_trg() from public, anon, authenticated;
revoke execute on function public.reconcile_company_kanban_after_visit_trg() from public, anon, authenticated;
