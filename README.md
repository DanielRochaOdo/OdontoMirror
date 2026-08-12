# MirrorDesk

Painel corporativo de conferência e auditoria de conversas de WhatsApp, com operação **somente leitura** no nível da aplicação.

## O que está implementado

- login real com Supabase Auth e validação de perfil `admin` ativo;
- recuperação e alteração de senha;
- lista real dos números corporativos cadastrados no Supabase;
- criação de conta e conexão por QR Code real;
- sessões Multi-Device persistentes com `whatsapp-web.js`;
- reconexão, desconexão, sincronização e remoção de conta;
- captura de mensagens recebidas e observação das mensagens enviadas pelo celular corporativo;
- sincronização do histórico disponível por conversa;
- imagens, áudios, vídeos e documentos armazenados em bucket privado do Supabase Storage;
- URLs assinadas de curta duração para mídias;
- Supabase Realtime para contas, conversas e mensagens;
- auditoria real de visualizações e ações administrativas;
- exportação CSV dos registros de auditoria;
- edição do perfil administrativo;
- frontend sem controles falsos, telas demo ou mensagens “em breve”.

## Regra read-only

O backend não expõe operação de envio, resposta, reação, edição, exclusão de mensagem ou presença. A integração usa somente gerenciamento de sessão, leitura/sincronização e eventos observados do WhatsApp. A API também não contém endpoints para alteração de mensagens.

## Requisitos

- Node.js 20+ ou 22 LTS;
- npm;
- projeto Supabase com Auth, PostgreSQL, Storage e Realtime;
- ambiente Linux/Windows capaz de executar Chromium/Puppeteer;
- usuário administrativo criado no Supabase Auth e registro correspondente em `public.profiles` com `role = 'admin'` e `active = true`.

> A conexão por QR Code usa `whatsapp-web.js`, que se conecta ao WhatsApp Web e não é a API oficial Meta Cloud. Mudanças no WhatsApp Web podem exigir atualização da biblioteca.

## Instalação

```bash
npm install
copy .env.example .env
```

No Linux use `cp .env.example .env`.

Preencha todas as variáveis do Supabase. O sistema não possui fallback demonstrativo: sem configuração real ele não inicia corretamente.

## Banco

Execute, na ordem:

1. `supabase/migrations/202608120001_initial_schema.sql`
2. `supabase/migrations/202608120002_production_features.sql`

O bucket `whatsapp-media` permanece privado e as mídias são lidas por URLs assinadas.

## Primeiro administrador

1. Crie o usuário no Supabase Auth.
2. Copie o UUID do usuário.
3. Insira o perfil:

```sql
insert into public.profiles (id, name, role, active)
values ('UUID_DO_USUARIO', 'Administrador', 'admin', true);
```

## Desenvolvimento

```bash
npm run dev
```

Frontend: `http://localhost:5173`
API: `http://localhost:3333/health`

## Validação

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Produção sem Docker

```bash
npm run build
pm2 start ecosystem.config.cjs
```

As sessões do WhatsApp ficam no caminho definido por `WHATSAPP_SESSION_PATH` e não devem ser versionadas.

Se o servidor já possuir Chrome/Chromium compatível, configure `PUPPETEER_EXECUTABLE_PATH`. Caso contrário, a instalação do `whatsapp-web.js`/Puppeteer gerencia o navegador conforme a versão instalada.

## Histórico

`WHATSAPP_HISTORY_LIMIT` define quantas mensagens por conversa são importadas em cada sincronização manual/inicial. O padrão é 100 e o limite aceito pela configuração é 500.
