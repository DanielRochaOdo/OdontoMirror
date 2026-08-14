-- Sellers should only see themselves and co-responsible vendors on leads they can access.
drop policy if exists "commercial users read visible vendors" on public.commercial_vendors;
create policy "commercial users read visible vendors"
  on public.commercial_vendors for select
  using (
    public.is_active_admin()
    or mirror_user_id = auth.uid()
    or (
      public.is_active_seller()
      and exists (
        select 1
        from public.commercial_lead_assignments a
        where a.vendor_id = commercial_vendors.id
          and a.active = true
          and public.can_access_commercial_lead(a.lead_id)
      )
    )
  );

-- Shared notes/history should refresh for all current responsible sellers as well.
do $$
declare
  t text;
begin
  foreach t in array array['commercial_lead_status_history', 'commercial_lead_notes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
