-- Administrative contact override for commercial Kanban cards.
--
-- The Rotas phone remains the automatic source of identity. An administrator may override
-- the contact only by selecting an existing individual conversation from a WhatsApp inbox
-- currently assigned to one of the lead's responsible vendors. Seller responsibility is
-- never changed by this migration.

alter table public.commercial_leads
  add column if not exists automatic_phone_normalized text,
  add column if not exists manual_conversation_id uuid references public.conversations(id) on delete set null;

create index if not exists commercial_leads_automatic_phone_idx
  on public.commercial_leads(automatic_phone_normalized)
  where automatic_phone_normalized is not null;

create index if not exists commercial_leads_manual_conversation_idx
  on public.commercial_leads(manual_conversation_id)
  where manual_conversation_id is not null;

-- When a lead has a manual contact override, the automatic Rotas reconciliation must
-- recognize the original Rotas phone as already represented by that same card. This
-- prevents a second automatic card from being created by visit/message triggers.
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

  select * into v_existing
  from public.commercial_leads l
  where l.company_id = p_company_id
    and (
      public.normalize_br_phone(l.linked_phone_normalized) = v_phone
      or (
        l.link_source = 'manual'
        and public.normalize_br_phone(l.automatic_phone_normalized) = v_phone
      )
    )
  order by (l.link_source = 'manual') desc, l.created_at asc
  limit 1;

  if found then
    -- A manual administrator override always wins. Never replace its selected contact.
    if v_existing.link_source = 'manual' then
      return v_existing.id;
    end if;

    select * into v_contact
    from public.contacts c
    where public.normalize_br_phone(coalesce(c.phone_normalized, c.phone)) = v_phone
    order by c.updated_at desc, c.created_at desc
    limit 1;

    if v_contact.id is not null then
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

  select id into v_status_id
  from public.commercial_kanban_statuses
  where slug = 'pos-visita'
  limit 1;
  if v_status_id is null then
    raise exception 'Status inicial pos-visita não encontrado';
  end if;

  select * into v_contact
  from public.contacts c
  where public.normalize_br_phone(coalesce(c.phone_normalized, c.phone)) = v_phone
  order by c.updated_at desc, c.created_at desc
  limit 1;

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
    select l.id into v_lead_id
    from public.commercial_leads l
    where l.company_id = p_company_id
      and (
        public.normalize_br_phone(l.linked_phone_normalized) = v_phone
        or (
          l.link_source = 'manual'
          and public.normalize_br_phone(l.automatic_phone_normalized) = v_phone
        )
      )
    order by (l.link_source = 'manual') desc, l.created_at asc
    limit 1;
  end;

  return v_lead_id;
end;
$$;

-- Conversations that already represent the lead's current phone. Automatic matches are
-- limited to inboxes assigned to current responsible vendors. A manually selected
-- conversation remains visible to the administrator even if responsibility changes later.
create or replace function public.admin_list_commercial_lead_conversations(
  p_lead_id uuid
)
returns table (
  conversation_id uuid,
  whatsapp_account_id uuid,
  whatsapp_account_name text,
  vendor_id uuid,
  vendor_name text,
  contact_id uuid,
  contact_name text,
  phone text,
  phone_normalized text,
  last_message_at timestamptz,
  message_count integer,
  last_message_preview text,
  is_manual boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.commercial_leads;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_lead
  from public.commercial_leads
  where id = p_lead_id;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;

  return query
  select q.conversation_id,
         q.whatsapp_account_id,
         q.whatsapp_account_name,
         q.vendor_id,
         q.vendor_name,
         q.contact_id,
         q.contact_name,
         q.phone,
         q.phone_normalized,
         q.last_message_at,
         q.message_count,
         q.last_message_preview,
         q.is_manual
  from (
    select distinct on (cv.id)
      cv.id as conversation_id,
      cv.whatsapp_account_id,
      wa.name as whatsapp_account_name,
      wva.vendor_id,
      vendor.name as vendor_name,
      ct.id as contact_id,
      coalesce(nullif(ct.name, ''), nullif(cv.name, ''), 'Contato') as contact_name,
      coalesce(nullif(ct.phone, ''), cv.external_chat_id) as phone,
      public.normalize_br_phone(coalesce(ct.phone_normalized, ct.phone, cv.external_chat_id)) as phone_normalized,
      cv.last_message_at,
      cv.message_count,
      coalesce(cv.last_message_preview, '') as last_message_preview,
      (cv.id = v_lead.manual_conversation_id) as is_manual
    from public.conversations cv
    join public.whatsapp_accounts wa on wa.id = cv.whatsapp_account_id
    left join public.contacts ct on ct.id = cv.contact_id
    left join public.whatsapp_vendor_assignments wva on wva.whatsapp_account_id = cv.whatsapp_account_id
    left join public.commercial_vendors vendor on vendor.id = wva.vendor_id
    where cv.conversation_type = 'individual'
      and (
        cv.id = v_lead.manual_conversation_id
        or (
          public.normalize_br_phone(coalesce(ct.phone_normalized, ct.phone, cv.external_chat_id))
            = public.normalize_br_phone(v_lead.linked_phone_normalized)
          and exists (
            select 1
            from public.commercial_lead_assignments a
            where a.lead_id = p_lead_id
              and a.active = true
              and a.vendor_id = wva.vendor_id
          )
        )
      )
    order by cv.id, cv.last_message_at desc nulls last
  ) q
  order by q.is_manual desc, q.last_message_at desc nulls last, q.contact_name asc;
end;
$$;

-- Searchable inbox options for an administrator. The query is deliberately scoped by
-- active lead assignment -> WhatsApp/vendor ownership, so a contact from an unrelated
-- seller's inbox cannot be selected even if the administrator knows its phone number.
create or replace function public.admin_list_commercial_lead_contact_candidates(
  p_lead_id uuid,
  p_search text default null,
  p_limit integer default 100
)
returns table (
  conversation_id uuid,
  whatsapp_account_id uuid,
  whatsapp_account_name text,
  vendor_id uuid,
  vendor_name text,
  contact_id uuid,
  contact_name text,
  phone text,
  phone_normalized text,
  last_message_at timestamptz,
  message_count integer,
  last_message_preview text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_digits text := regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g');
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.commercial_leads where id = p_lead_id) then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  return query
  select distinct
    cv.id as conversation_id,
    cv.whatsapp_account_id,
    wa.name as whatsapp_account_name,
    vendor.id as vendor_id,
    vendor.name as vendor_name,
    ct.id as contact_id,
    coalesce(nullif(ct.name, ''), nullif(cv.name, ''), 'Contato') as contact_name,
    coalesce(nullif(ct.phone, ''), cv.external_chat_id) as phone,
    public.normalize_br_phone(coalesce(ct.phone_normalized, ct.phone, cv.external_chat_id)) as phone_normalized,
    cv.last_message_at,
    cv.message_count,
    coalesce(cv.last_message_preview, '') as last_message_preview
  from public.commercial_lead_assignments a
  join public.commercial_vendors vendor
    on vendor.id = a.vendor_id and vendor.active = true
  join public.whatsapp_vendor_assignments wva
    on wva.vendor_id = a.vendor_id
  join public.whatsapp_accounts wa
    on wa.id = wva.whatsapp_account_id
  join public.conversations cv
    on cv.whatsapp_account_id = wa.id and cv.conversation_type = 'individual'
  left join public.contacts ct
    on ct.id = cv.contact_id
  where a.lead_id = p_lead_id
    and a.active = true
    and (
      v_search is null
      or coalesce(ct.name, cv.name, '') ilike '%' || v_search || '%'
      or coalesce(ct.phone, cv.external_chat_id, '') ilike '%' || v_search || '%'
      or coalesce(cv.last_message_preview, '') ilike '%' || v_search || '%'
      or (
        length(v_digits) > 0
        and public.normalize_br_phone(coalesce(ct.phone_normalized, ct.phone, cv.external_chat_id))
              like '%' || v_digits || '%'
      )
    )
  order by cv.last_message_at desc nulls last,
           coalesce(nullif(ct.name, ''), nullif(cv.name, ''), 'Contato') asc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function public.admin_set_commercial_lead_contact_override(
  p_lead_id uuid,
  p_conversation_id uuid
)
returns public.commercial_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.commercial_leads;
  v_choice record;
  v_contact_id uuid;
  v_phone text;
  v_automatic_phone text;
  v_result public.commercial_leads;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_lead
  from public.commercial_leads
  where id = p_lead_id
  for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;

  select
    cv.id as conversation_id,
    cv.whatsapp_account_id,
    cv.external_chat_id,
    cv.name as conversation_name,
    ct.id as contact_id,
    ct.name as contact_name,
    ct.phone as contact_phone,
    ct.phone_normalized,
    wa.name as whatsapp_account_name,
    wva.vendor_id,
    vendor.name as vendor_name
  into v_choice
  from public.conversations cv
  join public.whatsapp_accounts wa on wa.id = cv.whatsapp_account_id
  join public.whatsapp_vendor_assignments wva on wva.whatsapp_account_id = cv.whatsapp_account_id
  join public.commercial_vendors vendor on vendor.id = wva.vendor_id and vendor.active = true
  left join public.contacts ct on ct.id = cv.contact_id
  where cv.id = p_conversation_id
    and cv.conversation_type = 'individual'
    and exists (
      select 1
      from public.commercial_lead_assignments a
      where a.lead_id = p_lead_id
        and a.active = true
        and a.vendor_id = wva.vendor_id
    )
  limit 1;

  if not found then
    raise exception 'CONVERSATION_NOT_AVAILABLE_FOR_LEAD_VENDOR';
  end if;

  v_phone := public.normalize_br_phone(
    coalesce(v_choice.phone_normalized, v_choice.contact_phone, v_choice.external_chat_id)
  );
  if v_phone is null then raise exception 'CONVERSATION_PHONE_NOT_AVAILABLE'; end if;

  if exists (
    select 1
    from public.commercial_leads other
    where other.id <> p_lead_id
      and other.company_id = v_lead.company_id
      and public.normalize_br_phone(other.linked_phone_normalized) = v_phone
  ) then
    raise exception 'CONTACT_ALREADY_LINKED_TO_COMPANY';
  end if;

  v_contact_id := v_choice.contact_id;
  if v_contact_id is null then
    insert into public.contacts(
      whatsapp_account_id,
      external_contact_id,
      name,
      phone
    ) values (
      v_choice.whatsapp_account_id,
      v_choice.external_chat_id,
      coalesce(nullif(v_choice.conversation_name, ''), v_phone),
      v_phone
    )
    on conflict (whatsapp_account_id, external_contact_id)
    do update set
      name = coalesce(nullif(excluded.name, ''), public.contacts.name),
      phone = excluded.phone,
      updated_at = now()
    returning id into v_contact_id;

    update public.conversations
    set contact_id = v_contact_id,
        updated_at = now()
    where id = p_conversation_id;
  end if;

  if v_lead.link_source = 'automatic' then
    v_automatic_phone := public.normalize_br_phone(v_lead.linked_phone_normalized);
  else
    v_automatic_phone := public.normalize_br_phone(v_lead.automatic_phone_normalized);
  end if;

  -- Legacy manual leads may not yet have an automatic baseline. Infer it only when the
  -- Rotas company currently has exactly one phone; otherwise leave it unset instead of guessing.
  if v_automatic_phone is null then
    select min(public.normalize_br_phone(cp.phone_normalized))
    into v_automatic_phone
    from public.commercial_company_phones cp
    where cp.company_id = v_lead.company_id
      and cp.source = 'rotas'
    having count(distinct public.normalize_br_phone(cp.phone_normalized)) = 1;
  end if;

  update public.commercial_leads
  set contact_id = v_contact_id,
      whatsapp_account_id = v_choice.whatsapp_account_id,
      contact_name = coalesce(nullif(v_choice.contact_name, ''), nullif(v_choice.conversation_name, ''), contact_name),
      contact_phone = coalesce(nullif(v_choice.contact_phone, ''), v_phone),
      linked_phone_normalized = v_phone,
      link_source = 'manual',
      automatic_phone_normalized = coalesce(automatic_phone_normalized, v_automatic_phone),
      manual_conversation_id = p_conversation_id,
      archived = false,
      updated_at = now()
  where id = p_lead_id
  returning * into v_result;

  insert into public.audit_logs(
    admin_id, action, entity_type, entity_id, whatsapp_account_id, metadata
  ) values (
    auth.uid(),
    'COMMERCIAL_LEAD_CONTACT_OVERRIDE',
    'commercial_lead',
    p_lead_id,
    v_choice.whatsapp_account_id,
    jsonb_build_object(
      'entity_label', v_result.display_name,
      'previous_phone', v_lead.linked_phone_normalized,
      'selected_phone', v_phone,
      'conversation_id', p_conversation_id,
      'vendor_id', v_choice.vendor_id,
      'vendor_name', v_choice.vendor_name,
      'whatsapp_account_name', v_choice.whatsapp_account_name
    )
  );

  perform public.refresh_commercial_lead_metrics_for_phone(v_phone);
  return v_result;
end;
$$;

create or replace function public.admin_restore_commercial_lead_automatic_contact(
  p_lead_id uuid
)
returns public.commercial_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.commercial_leads;
  v_phone text;
  v_phone_count integer;
  v_match record;
  v_company_contact_name text;
  v_result public.commercial_leads;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_lead
  from public.commercial_leads
  where id = p_lead_id
  for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;

  if v_lead.link_source = 'automatic' then return v_lead; end if;

  v_phone := public.normalize_br_phone(v_lead.automatic_phone_normalized);

  if v_phone is null or not exists (
    select 1
    from public.commercial_company_phones cp
    where cp.company_id = v_lead.company_id
      and cp.source = 'rotas'
      and public.normalize_br_phone(cp.phone_normalized) = v_phone
  ) then
    select count(distinct public.normalize_br_phone(cp.phone_normalized))::integer
    into v_phone_count
    from public.commercial_company_phones cp
    where cp.company_id = v_lead.company_id
      and cp.source = 'rotas'
      and public.normalize_br_phone(cp.phone_normalized) is not null;

    if coalesce(v_phone_count, 0) = 0 then raise exception 'AUTOMATIC_PHONE_NOT_AVAILABLE'; end if;
    if v_phone_count > 1 then raise exception 'AUTOMATIC_PHONE_AMBIGUOUS'; end if;

    select public.normalize_br_phone(cp.phone_normalized)
    into v_phone
    from public.commercial_company_phones cp
    where cp.company_id = v_lead.company_id
      and cp.source = 'rotas'
      and public.normalize_br_phone(cp.phone_normalized) is not null
    limit 1;
  end if;

  select cc.contact_name into v_company_contact_name
  from public.commercial_companies cc
  where cc.id = v_lead.company_id;

  -- Prefer a matching conversation in one of the current responsible vendors' inboxes.
  select
    ct.id as contact_id,
    cv.whatsapp_account_id,
    coalesce(nullif(ct.name, ''), nullif(cv.name, '')) as contact_name,
    coalesce(nullif(ct.phone, ''), v_phone) as contact_phone
  into v_match
  from public.commercial_lead_assignments a
  join public.whatsapp_vendor_assignments wva on wva.vendor_id = a.vendor_id
  join public.conversations cv on cv.whatsapp_account_id = wva.whatsapp_account_id
  left join public.contacts ct on ct.id = cv.contact_id
  where a.lead_id = p_lead_id
    and a.active = true
    and cv.conversation_type = 'individual'
    and public.normalize_br_phone(coalesce(ct.phone_normalized, ct.phone, cv.external_chat_id)) = v_phone
  order by cv.last_message_at desc nulls last
  limit 1;

  update public.commercial_leads
  set contact_id = v_match.contact_id,
      whatsapp_account_id = v_match.whatsapp_account_id,
      contact_name = coalesce(v_company_contact_name, v_match.contact_name),
      contact_phone = coalesce(v_match.contact_phone, v_phone),
      linked_phone_normalized = v_phone,
      link_source = 'automatic',
      automatic_phone_normalized = null,
      manual_conversation_id = null,
      archived = not exists (
        select 1 from public.commercial_visits visit
        where visit.company_id = v_lead.company_id
          and visit.completed_at is not null
      ),
      updated_at = now()
  where id = p_lead_id
  returning * into v_result;

  insert into public.audit_logs(
    admin_id, action, entity_type, entity_id, whatsapp_account_id, metadata
  ) values (
    auth.uid(),
    'COMMERCIAL_LEAD_CONTACT_RESTORED',
    'commercial_lead',
    p_lead_id,
    v_result.whatsapp_account_id,
    jsonb_build_object(
      'entity_label', v_result.display_name,
      'previous_phone', v_lead.linked_phone_normalized,
      'restored_phone', v_phone,
      'source', 'rotas'
    )
  );

  perform public.refresh_commercial_lead_metrics_for_phone(v_phone);
  return v_result;
end;
$$;

revoke execute on function public.admin_list_commercial_lead_conversations(uuid) from public, anon;
revoke execute on function public.admin_list_commercial_lead_contact_candidates(uuid, text, integer) from public, anon;
revoke execute on function public.admin_set_commercial_lead_contact_override(uuid, uuid) from public, anon;
revoke execute on function public.admin_restore_commercial_lead_automatic_contact(uuid) from public, anon;

grant execute on function public.admin_list_commercial_lead_conversations(uuid) to authenticated;
grant execute on function public.admin_list_commercial_lead_contact_candidates(uuid, text, integer) to authenticated;
grant execute on function public.admin_set_commercial_lead_contact_override(uuid, uuid) to authenticated;
grant execute on function public.admin_restore_commercial_lead_automatic_contact(uuid) to authenticated;
