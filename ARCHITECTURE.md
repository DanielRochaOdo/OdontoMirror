# Arquitetura

O workspace usa npm workspaces:

- `apps/web`: React 19 + Vite + TypeScript, React Router, TanStack Query, Zustand, React Hook Form/Zod, Lucide, Sonner e Tailwind CSS.
- `server`: Fastify + TypeScript. Responsável por sessões e por ser a única fronteira possível com o provider WhatsApp.
- `supabase/migrations`: schema reproduzível, índices, RLS e Storage privado.

O carregamento é hierárquico: contas → conversas filtradas por `whatsappAccountId` → mensagens filtradas por conta e conversa. A query de conversas usa a chave `['conversations', accountId, search]`, evitando uma consulta global.

O provider é uma porta (`WhatsAppReadOnlyProvider`) e o adapter atual é deliberadamente um stub seguro até que uma biblioteca, licença e documentação atual sejam aprovadas. Nenhuma operação de escrita ou presença faz parte da interface.
