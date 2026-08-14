create or replace function public.guard_initial_commercial_status()
returns trigger
language plpgsql
as $$
begin
  if old.slug = 'pos-visita' then
    if tg_op = 'DELETE' then
      raise exception 'INITIAL_KANBAN_STATUS_REQUIRED';
    end if;
    if new.active = false then
      raise exception 'INITIAL_KANBAN_STATUS_REQUIRED';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists commercial_initial_status_guard_trg on public.commercial_kanban_statuses;
create trigger commercial_initial_status_guard_trg
before update or delete on public.commercial_kanban_statuses
for each row execute function public.guard_initial_commercial_status();
