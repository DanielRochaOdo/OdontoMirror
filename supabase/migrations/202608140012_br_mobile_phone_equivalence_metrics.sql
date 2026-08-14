-- PR #15 follow-up for the automatic Rotas -> Kanban flow introduced in 202608140011.
--
-- Some WhatsApp JIDs expose Brazilian mobile numbers in the historical 8-digit form
-- (for example 55 85 8766-1518), while Rotas may store the same mobile with the
-- mandatory ninth digit (55 85 9 8766-1518). They represent the same destination.
--
-- This migration canonicalizes Brazilian mobile phones and installs incremental metric
-- refreshes. It intentionally does NOT recalculate every Rotas phone in one statement:
-- production databases can contain enough WhatsApp history for that global backfill to
-- exceed the hosted statement timeout. Existing cards are recalculated incrementally by
-- visit/message events and may also be refreshed explicitly per lead/phone by admin flows.

create or replace function public.normalize_br_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
  v_subscriber text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_digits := regexp_replace(v_digits, '^0+', '');

  if length(v_digits) in (10, 11) then
    v_digits := '55' || v_digits;
  end if;

  -- Brazil + DDD + historical 8-digit mobile. Insert the ninth digit only when
  -- the old subscriber prefix identifies a mobile range.
  if length(v_digits) = 12 and left(v_digits, 2) = '55' then
    v_subscriber := substring(v_digits from 5);
    if length(v_subscriber) = 8 and left(v_subscriber, 1) in ('6', '7', '8', '9') then
      return left(v_digits, 4) || '9' || v_subscriber;
    end if;
    return v_digits;
  end if;

  if length(v_digits) = 13 and left(v_digits, 2) = '55' then
    return v_digits;
  end if;

  return case when length(v_digits) >= 10 then v_digits else null end;
end;
$$;

-- Guard the exact production case and ensure fixed lines are not rewritten.
do $$
begin
  if public.normalize_br_phone('85987661518') <> '5585987661518' then
    raise exception 'BR_PHONE_NORMALIZATION_CURRENT_MOBILE_FAILED';
  end if;
  if public.normalize_br_phone('558587661518') <> '5585987661518' then
    raise exception 'BR_PHONE_NORMALIZATION_LEGACY_MOBILE_FAILED';
  end if;
  if public.normalize_br_phone('558532341234') <> '558532341234' then
    raise exception 'BR_PHONE_NORMALIZATION_FIXED_LINE_FAILED';
  end if;
end;
$$;

update public.contacts
set phone_normalized = public.normalize_br_phone(phone),
    updated_at = now()
where phone_normalized is distinct from public.normalize_br_phone(phone);

-- Remove only duplicates that collapse to the same canonical company/source/phone key.
delete from public.commercial_company_phones a
using public.commercial_company_phones b
where a.id <> b.id
  and a.company_id = b.company_id
  and a.source = b.source
  and public.normalize_br_phone(a.phone_normalized) is not null
  and public.normalize_br_phone(a.phone_normalized) = public.normalize_br_phone(b.phone_normalized)
  and (a.created_at, a.id) > (b.created_at, b.id);

update public.commercial_company_phones
set phone_normalized = public.normalize_br_phone(phone_normalized),
    updated_at = now()
where public.normalize_br_phone(phone_normalized) is not null
  and phone_normalized is distinct from public.normalize_br_phone(phone_normalized);

create or replace function public.canonicalize_commercial_company_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone_normalized := public.normalize_br_phone(new.phone_normalized);
  return new;
end;
$$;

drop trigger if exists commercial_company_phone_canonicalize_trg on public.commercial_company_phones;
create trigger commercial_company_phone_canonicalize_trg
before insert or update of phone_normalized on public.commercial_company_phones
for each row execute function public.canonicalize_commercial_company_phone();

-- Canonicalize existing lead identities only when the result cannot collide with another
-- historical lead for the same company.
update public.commercial_leads l
set linked_phone_normalized = public.normalize_br_phone(l.linked_phone_normalized),
    updated_at = now()
where l.linked_phone_normalized is not null
  and public.normalize_br_phone(l.linked_phone_normalized) is not null
  and l.linked_phone_normalized is distinct from public.normalize_br_phone(l.linked_phone_normalized)
  and not exists (
    select 1
    from public.commercial_leads other
    where other.id <> l.id
      and other.company_id = l.company_id
      and public.normalize_br_phone(other.linked_phone_normalized) = public.normalize_br_phone(l.linked_phone_normalized)
  );

-- Helps resolve conversations that do not yet have a contact row attached.
create index if not exists conversations_external_chat_phone_normalized_idx
  on public.conversations(public.normalize_br_phone(external_chat_id));

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
  where public.normalize_br_phone(coalesce(phone_normalized, phone)) = v_phone
  order by updated_at desc, created_at desc
  limit 1;

  select * into v_existing
  from public.commercial_leads
  where company_id = p_company_id
    and public.normalize_br_phone(linked_phone_normalized) = v_phone
  order by (link_source = 'manual') desc, created_at asc
  limit 1;

  if found then
    if v_existing.link_source = 'automatic' and v_contact.id is not null then
      update public.commercial_leads
      set contact_id = v_contact.id,
          whatsapp_account_id = v_contact.whatsapp_account_id,
          contact_name = coalesce(v_company.contact_name, v_contact.name, contact_name),
          contact_phone = coalesce(v_contact.phone, contact_phone, v_phone),
          linked_phone_normalized = v_phone,
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
      and public.normalize_br_phone(linked_phone_normalized) = v_phone
    order by (link_source = 'manual') desc, created_at asc
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
    and public.normalize_br_phone(phone_normalized) = v_phone;

  if v_company_count = 1 then
    select company_id
    into v_company_id
    from public.commercial_company_phones
    where source = 'rotas'
      and public.normalize_br_phone(phone_normalized) = v_phone
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
    update public.commercial_leads
    set archived = true,
        updated_at = now()
    where link_source = 'automatic'
      and public.normalize_br_phone(linked_phone_normalized) = v_phone
      and archived = false;
  end if;
end;
$$;

-- Recalculate one phone at a time. The query first resolves the small set of matching
-- conversation ids and then uses the existing messages(conversation_id, sent_at) index.
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
    where public.normalize_br_phone(linked_phone_normalized) = v_phone
  loop
    select max(completed_at)
    into v_last_visit_at
    from public.commercial_visits
    where company_id = v_lead.company_id
      and completed_at is not null;

    with matched_conversations as (
      select cv.id
      from public.conversations cv
      join public.contacts ct on ct.id = cv.contact_id
      where ct.phone_normalized = v_phone
      union
      select cv.id
      from public.conversations cv
      where public.normalize_br_phone(cv.external_chat_id) = v_phone
    )
    select
      max(m.sent_at),
      min(m.sent_at) filter (where v_last_visit_at is not null and m.sent_at >= v_last_visit_at),
      count(*) filter (where v_last_visit_at is not null and m.sent_at >= v_last_visit_at)::integer,
      count(*) filter (where v_last_visit_at is not null and m.sent_at >= v_last_visit_at and m.direction = 'inbound')::integer,
      count(*) filter (where v_last_visit_at is not null and m.sent_at >= v_last_visit_at and m.direction = 'outbound')::integer
    into
      v_last_interaction,
      v_first_after_visit,
      v_interaction_count,
      v_inbound_count,
      v_outbound_count
    from public.messages m
    join matched_conversations mc on mc.id = m.conversation_id;

    v_interaction_count := coalesce(v_interaction_count, 0);
    v_inbound_count := coalesce(v_inbound_count, 0);
    v_outbound_count := coalesce(v_outbound_count, 0);

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
      v_interaction_count,
      v_inbound_count,
      v_outbound_count,
      v_followup_delay,
      v_days_without_interaction,
      (v_last_visit_at is not null and v_interaction_count = 0),
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
  select public.normalize_br_phone(coalesce(ct.phone_normalized, ct.phone, cv.external_chat_id))
  into v_phone
  from public.conversations cv
  left join public.contacts ct on ct.id = cv.contact_id
  where cv.id = new.conversation_id;

  if v_phone is not null then
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

revoke execute on function public.canonicalize_commercial_company_phone() from public, anon, authenticated;
revoke execute on function public.ensure_automatic_commercial_lead_for_company_phone(uuid, text) from public, anon, authenticated;
revoke execute on function public.reconcile_automatic_commercial_leads_for_phone(text) from public, anon, authenticated;
revoke execute on function public.refresh_commercial_lead_metrics_for_phone(text) from public, anon, authenticated;
revoke execute on function public.refresh_commercial_metrics_after_message_trg() from public, anon, authenticated;
