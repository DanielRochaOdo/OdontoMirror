create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'admin' check (role = 'admin'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(), name text not null, phone_number text not null,
  description text, profile_name text, profile_picture_url text,
  status text not null default 'disconnected' check (status in ('connected','disconnected','connecting','reconnecting','qr_required','error')),
  connected boolean not null default false, last_sync_at timestamptz, last_message_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(), whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  session_identifier text not null, status text not null, connected_at timestamptz, disconnected_at timestamptz, last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(), whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  external_contact_id text not null, name text not null, phone text not null, profile_picture_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (whatsapp_account_id, external_contact_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null, external_chat_id text not null, conversation_type text not null default 'individual',
  name text not null, last_message_at timestamptz, last_message_preview text, message_count integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (whatsapp_account_id, external_chat_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id) on delete cascade,
  external_message_id text not null unique, sender_phone text not null, sender_name text,
  direction text not null check (direction in ('inbound','outbound')), message_type text not null check (message_type in ('text','image','audio','video','document')),
  text_content text, sent_at timestamptz not null, media_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id) on delete cascade,
  media_type text not null, mime_type text not null, file_name text, file_size bigint, storage_path text not null, thumbnail_path text,
  duration integer, created_at timestamptz not null default now()
);
alter table public.messages add constraint messages_media_id_fkey foreign key (media_id) references public.media_files(id) on delete set null;
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), admin_id uuid not null references public.profiles(id), action text not null, entity_type text not null,
  entity_id uuid, whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null, ip_address text, user_agent text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists whatsapp_accounts_status_idx on public.whatsapp_accounts(status);
create index if not exists conversations_account_idx on public.conversations(whatsapp_account_id);
create index if not exists conversations_account_last_message_idx on public.conversations(whatsapp_account_id, last_message_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id);
create index if not exists messages_conversation_sent_idx on public.messages(conversation_id, sent_at desc);
create index if not exists messages_account_idx on public.messages(whatsapp_account_id);
create index if not exists messages_external_id_idx on public.messages(external_message_id);
create index if not exists contacts_account_idx on public.contacts(whatsapp_account_id);
create index if not exists contacts_phone_idx on public.contacts(phone);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_admin_idx on public.audit_logs(admin_id);

alter table public.profiles enable row level security;
alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.media_files enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_active_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true);
$$;
create policy "admins read profiles" on public.profiles for select using (id = auth.uid() and public.is_active_admin());
create policy "admins read accounts" on public.whatsapp_accounts for select using (public.is_active_admin());
create policy "admins read sessions" on public.whatsapp_sessions for select using (public.is_active_admin());
create policy "admins read contacts" on public.contacts for select using (public.is_active_admin());
create policy "admins read conversations" on public.conversations for select using (public.is_active_admin());
create policy "admins read messages" on public.messages for select using (public.is_active_admin());
create policy "admins read media metadata" on public.media_files for select using (public.is_active_admin());
create policy "admins read audit logs" on public.audit_logs for select using (public.is_active_admin());

insert into storage.buckets (id, name, public) values ('whatsapp-media', 'whatsapp-media', false) on conflict (id) do update set public = false;
create policy "admins read private whatsapp media" on storage.objects for select using (bucket_id = 'whatsapp-media' and public.is_active_admin());
