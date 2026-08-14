alter table public.commercial_company_phones
  drop constraint if exists commercial_company_phones_company_id_phone_normalized_key;

alter table public.commercial_company_phones
  add constraint commercial_company_phones_company_phone_source_key
  unique(company_id, phone_normalized, source);

create or replace function public.register_manual_commercial_phone_override(
  p_company_id uuid,
  p_phone_normalized text,
  p_contact_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_phone_normalized is null or length(trim(p_phone_normalized)) = 0 then return; end if;
  insert into public.commercial_company_phones(company_id, phone_normalized, contact_name, source)
  values (p_company_id, p_phone_normalized, p_contact_name, 'manual')
  on conflict (company_id, phone_normalized, source)
  do update set contact_name = excluded.contact_name, updated_at = now();
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
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_contact from public.contacts where id = p_contact_id;
  if not found then raise exception 'CONTACT_NOT_FOUND'; end if;
  select * into v_company from public.commercial_companies where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
  if v_contact.phone_normalized is null then raise exception 'CONTACT_PHONE_NOT_NORMALIZED'; end if;

  perform public.register_manual_commercial_phone_override(v_company.id, v_contact.phone_normalized, v_contact.name);

  select id into v_status_id from public.commercial_kanban_statuses
  where slug = 'pos-visita' and active = true limit 1;
  if v_status_id is null then raise exception 'INITIAL_KANBAN_STATUS_REQUIRED'; end if;

  select * into v_lead from public.commercial_leads
  where company_id = p_company_id and linked_phone_normalized = v_contact.phone_normalized limit 1;

  if found then
    update public.commercial_leads
    set contact_id = v_contact.id,
        whatsapp_account_id = v_contact.whatsapp_account_id,
        contact_name = v_contact.name,
        contact_phone = v_contact.phone,
        department = coalesce(nullif(trim(coalesce(p_department, '')), ''), department),
        display_name = coalesce(nullif(trim(coalesce(p_display_name, '')), ''), display_name),
        link_source = 'manual', archived = false, updated_at = now()
    where id = v_lead.id returning * into v_lead;
    return v_lead;
  end if;

  insert into public.commercial_leads(
    company_id, contact_id, whatsapp_account_id, display_name, department,
    contact_name, contact_phone, linked_phone_normalized, status_id, link_source, archived
  ) values (
    v_company.id, v_contact.id, v_contact.whatsapp_account_id,
    coalesce(nullif(trim(coalesce(p_display_name, '')), ''), v_company.company_name),
    nullif(trim(coalesce(p_department, '')), ''), v_contact.name, v_contact.phone,
    v_contact.phone_normalized, v_status_id, 'manual', false
  ) returning * into v_lead;
  return v_lead;
end;
$$;

create or replace function public.admin_relink_commercial_lead(p_lead_id uuid, p_company_id uuid)
returns public.commercial_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.commercial_leads;
  v_company public.commercial_companies;
begin
  if not public.is_active_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_company from public.commercial_companies where id = p_company_id;
  if not found then raise exception 'COMPANY_NOT_FOUND'; end if;
  select * into v_lead from public.commercial_leads where id = p_lead_id for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;

  perform public.register_manual_commercial_phone_override(
    v_company.id,
    v_lead.linked_phone_normalized,
    v_lead.contact_name
  );

  update public.commercial_leads
  set company_id = p_company_id,
      display_name = case when link_source = 'automatic' then v_company.company_name else display_name end,
      link_source = 'manual',
      archived = false,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;
  return v_lead;
end;
$$;

grant execute on function public.admin_link_commercial_contact(uuid, uuid, text, text) to authenticated;
grant execute on function public.admin_relink_commercial_lead(uuid, uuid) to authenticated;
