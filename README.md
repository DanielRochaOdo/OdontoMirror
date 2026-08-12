# MirrorDesk

Painel corporativo de conferência e auditoria de conversas WhatsApp, com operação exclusivamente **read-only**.

## Estado do MVP

O projeto já inclui o fluxo navegável de login, lista de números, carregamento hierárquico de conversas e mensagens, visualização de mídias, auditoria, configurações, API Fastify protegida por Helmet/CORS/rate limit e migration Supabase com RLS e bucket privado. O frontend inicia com dados demonstrativos quando as variáveis do Supabase ainda não foram configuradas.

## Requisitos

- Node.js LTS e npm
- Projeto Supabase com Auth, PostgreSQL, Storage e Realtime habilitados
- Um usuário administrativo criado no Supabase Auth

## Instalação

```bash
npm install
copy .env.example .env
npm run dev
```

Frontend: `http://localhost:5173` · API: `http://localhost:3333/health`.

## Variáveis

O frontend só recebe `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_API_URL`. A `SUPABASE_SERVICE_ROLE_KEY` existe apenas no processo do backend e nunca deve receber prefixo `VITE_`.

## Supabase

Execute `supabase/migrations/202608120001_initial_schema.sql` via Supabase CLI ou pipeline de migrations. A migration cria as oito tabelas do domínio, índices, RLS e o bucket privado `whatsapp-media`. Mídias devem usar caminhos baseados em UUID e URLs assinadas de curta duração.

## Comandos

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run format
```

## Produção com PM2

Após `npm run build`, execute `pm2 start ecosystem.config.cjs`. O processo do backend é `whatsapp-monitor-api`; sessões locais e segredos não devem ser versionados.

## Primeiro administrador

Crie o usuário em Supabase Auth e insira um registro correspondente em `public.profiles` com `role = 'admin'` e `active = true`. O frontend deve trocar o login demonstrativo pela sessão do Supabase antes do uso em produção.

## Regra de segurança

O provider em `server/src/whatsapp` possui somente operações de sessão e consulta. Não existe endpoint de alteração de mensagens, presença ou interação com clientes. O navegador nunca se conecta diretamente a uma biblioteca WhatsApp.
