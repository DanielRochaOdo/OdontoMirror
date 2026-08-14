-- A lead is a commercial relationship for one company + one WhatsApp phone.
-- The same phone may appear in more than one mirrored corporate WhatsApp account,
-- but it must remain one shared Kanban card/journey.

alter table public.commercial_leads
  drop constraint if exists commercial_leads_company_id_contact_id_key;

create unique index if not exists commercial_leads_company_phone_uidx
  on public.commercial_leads(company_id, linked_phone_normalized)
  where linked_phone_normalized is not null;
