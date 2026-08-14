create or replace function public.admin_list_unmatched_commercial_contacts(
  p_search text default null,
  p_limit integer default 100
)
returns table (
  contact_id uuid,
  whatsapp_account_id uuid,
  account_name text,
  contact_name text,
  phone text,
  phone_normalized text,
  last_message_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  select
    c.id,
    c.whatsapp_account_id,
    wa.name,
    c.name,
    c.phone,
    c.phone_normalized,
    max(cv.last_message_at)
  from public.contacts c
  join public.whatsapp_accounts wa on wa.id = c.whatsapp_account_id
  left join public.conversations cv on cv.contact_id = c.id
  where c.phone_normalized is not null
    and not exists (
      select 1
      from public.commercial_leads l
      where l.linked_phone_normalized = c.phone_normalized
    )
    and (
      nullif(trim(coalesce(p_search, '')), '') is null
      or c.name ilike '%' || trim(p_search) || '%'
      or c.phone ilike '%' || trim(p_search) || '%'
      or c.phone_normalized ilike '%' || regexp_replace(trim(p_search), '[^0-9]', '', 'g') || '%'
    )
  group by c.id, c.whatsapp_account_id, wa.name, c.name, c.phone, c.phone_normalized
  order by max(cv.last_message_at) desc nulls last, c.name asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

create or replace function public.admin_link_commercial_contact(
  p_contact_id uuid,
  p_company_id uuid,
  p_department text default null,
  p_display_name text default null
)
returns public.commercial_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact public.contacts;
  v_company public.commercial_companies;
  v_status_id uuid;
  v_lead public.commercial_leads;
begin
  if not public.is_active_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_contact from public.contacts where id = p_contact_id;
  if not found then raise exception 'CONTACT_NOT_FOUND'; end if;

  select * into v_company from public.commercial_companies where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;

  if v_contact.phone_normalized is null then
    raise exception 'CONTACT_PHONE_NOT_NORMALIZED';
  end if;

  select id into v_status_id
  from public.commercial_kanban_statuses
  where slug = 'pos-visita' and active = true
  limit 1;
  if v_status_id is null then raise exception 'INITIAL_KANBAN_STATUS_REQUIRED'; end if;

  select * into v_lead
  from public.commercial_leads
  where company_id = p_company_id
    and linked_phone_normalized = v_contact.phone_normalized
  limit 1;

  if found then
    update public.commercial_leads
    set contact_id = v_contact.id,
        whatsapp_account_id = v_contact.whatsapp_account_id,
        contact_name = v_contact.name,
        contact_phone = v_contact.phone,
        department = coalesce(nullif(trim(coalesce(p_department, '')), ''), department),
        display_name = coalesce(nullif(trim(coalesce(p_display_name, '')), ''), display_name),
        link_source = 'manual',
        archived = false,
        updated_at = now()
    where id = v_lead.id
    returning * into v_lead;
    return v_lead;
  end if;

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
    link_source,
    archived
  ) values (
    v_company.id,
    v_contact.id,
    v_contact.whatsapp_account_id,
    coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_company.company_name),
    nullif(trim(coalesce(p_department, '')), ''),
    v_contact.name,
    v_contact.phone,
    v_contact.phone_normalized,
    v_status_id,
    'manual',
    false
  ) returning * into v_lead;

  return v_lead;
end;
$$;

grant execute on function public.admin_list_unmatched_commercial_contacts(text, integer) to authenticated;
grant execute on function public.admin_link_commercial_contact(uuid, uuid, text, text) to authenticated;
