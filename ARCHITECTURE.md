# Arquitetura

O projeto usa npm workspaces e não depende de Docker.

- `apps/web`: React 19 + Vite + TypeScript, React Router, TanStack Query, Zustand, React Hook Form/Zod, Lucide, Sonner e Tailwind CSS.
- `server`: Fastify + TypeScript. Autentica cada chamada privilegiada com o JWT do Supabase e concentra toda a integração com WhatsApp.
- `server/src/whatsapp/providers/WhatsAppProviderImplementation.ts`: adapter real baseado em `whatsapp-web.js` + `LocalAuth`, isolado pela interface `WhatsAppReadOnlyProvider`.
- `supabase/migrations`: schema reproduzível, índices, RLS, Storage privado, função de auditoria e publicação Realtime.

## Fluxo de dados

1. O administrador autentica pelo Supabase Auth.
2. O frontend lista apenas `whatsapp_accounts`.
3. Ao abrir uma conta, consulta somente as conversas daquele `whatsapp_account_id`.
4. Ao abrir uma conversa, consulta somente as mensagens daquela conta e conversa.
5. Criação de sessão, QR, reconexão, desconexão, sincronização e remoção passam pelo Fastify.
6. O provider observa eventos do WhatsApp, normaliza mensagens e grava PostgreSQL/Storage pelo client backend com service role.
7. O Supabase Realtime invalida o cache do TanStack Query quando contas, conversas ou mensagens mudam.

## Read-only

A fronteira `WhatsAppReadOnlyProvider` não expõe operações de envio, resposta, encaminhamento, reação, edição, exclusão ou presença. O frontend também não possui composer de mensagens nem endpoints equivalentes.

## Sessões

Cada conta usa `LocalAuth` com `clientId = whatsapp_account_id`. Os dados locais ficam sob `WHATSAPP_SESSION_PATH`, fora do Git. Na inicialização do backend, contas que não estejam marcadas como desconectadas são restauradas automaticamente.
