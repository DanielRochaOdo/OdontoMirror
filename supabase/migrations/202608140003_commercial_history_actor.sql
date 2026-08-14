alter table public.commercial_lead_status_history
  add column if not exists changed_by_name text;

alter table public.commercial_lead_notes
  add column if not exists author_name text;

create or replace function public.move_commercial_lead(p_lead_id uuid, p_status_id uuid)
returns public.commercial_leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.commercial_leads;
  v_role text;
  v_name text;
begin
  if not public.can_access_commercial_lead(p_lead_id) then
    raise exception 'COMMERCIAL_LEAD_ACCESS_DENIED';
  end if;

  if not exists (
    select 1 from public.commercial_kanban_statuses s
    where s.id = p_status_id and s.active = true
  ) then
    raise exception 'INVALID_KANBAN_STATUS';
  end if;

  select * into v_lead from public.commercial_leads where id = p_lead_id for update;
  if not found then raise exception 'LEAD_NOT_FOUND'; end if;
  if v_lead.status_id = p_status_id then return v_lead; end if;

  select role, name into v_role, v_name from public.profiles where id = auth.uid();

  insert into public.commercial_lead_status_history(
    lead_id, from_status_id, to_status_id, changed_by_profile_id, changed_by_role, changed_by_name
  ) values (
    p_lead_id, v_lead.status_id, p_status_id, auth.uid(), v_role, v_name
  );

  update public.commercial_leads
  set status_id = p_status_id,
      last_status_changed_at = now(),
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  return v_lead;
end;
$$;

create or replace function public.add_commercial_lead_note(p_lead_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.can_access_commercial_lead(p_lead_id) then
    raise exception 'COMMERCIAL_LEAD_ACCESS_DENIED';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'INVALID_NOTE';
  end if;

  select name into v_name from public.profiles where id = auth.uid();
  insert into public.commercial_lead_notes(lead_id, author_profile_id, author_name, note)
  values (p_lead_id, auth.uid(), v_name, trim(p_note))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.move_commercial_lead(uuid, uuid) to authenticated;
grant execute on function public.add_commercial_lead_note(uuid, text) to authenticated;
