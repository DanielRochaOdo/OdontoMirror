# Supabase

O Supabase é a fonte de verdade de autenticação, banco, mídia e atualizações em tempo real.

## Migrations

Execute em ordem:

1. `202608120001_initial_schema.sql` — tabelas, índices, RLS e bucket privado `whatsapp-media`.
2. `202608120002_production_features.sql` — unicidade de sessão por conta, edição segura do próprio perfil, RPC de auditoria e publicação Realtime.

## Auth e perfis

O login ocorre via Supabase Auth. Para acessar o painel, o usuário também precisa existir em `public.profiles` com `role = 'admin'` e `active = true`.

O primeiro perfil administrativo é criado após o usuário Auth existir:

```sql
insert into public.profiles (id, name, role, active)
values ('UUID_DO_USUARIO', 'Administrador', 'admin', true);
```

## RLS

As tabelas corporativas permanecem com RLS habilitado. O frontend usa apenas a anon key + sessão do administrador. A `SUPABASE_SERVICE_ROLE_KEY` é exclusiva do backend para ingestão e manutenção das sessões/dados.

## Storage

O bucket `whatsapp-media` é privado. Mídias são gravadas em caminhos formados por UUIDs e o frontend cria signed URLs temporárias para leitura.

## Realtime

A migration de produção adiciona `whatsapp_accounts`, `conversations` e `messages` à publicação `supabase_realtime`. O hook `useRealtimeSync` invalida os caches correspondentes do TanStack Query sem recarregar toda a aplicação.

## Auditoria

O frontend usa `public.log_audit_event(...)`. A função é `security definer`, valida `is_active_admin()` e deriva `admin_id` de `auth.uid()`, impedindo o cliente de atribuir um evento de auditoria a outro usuário.
