# MirrorDesk

Painel corporativo de conferência/auditoria de WhatsApp e acompanhamento comercial pós-visita.

## Módulos

### Administrador

- WhatsApps corporativos em modo somente leitura;
- conversas e mídias privadas;
- auditoria;
- Kanban comercial completo;
- configuração das etapas do Kanban;
- acompanhamento da sincronização com o Odontoart-rotas;
- fila de contatos que não puderam ser vinculados automaticamente a uma empresa.

### Vendedor

- acesso somente ao Kanban comercial;
- visualização apenas dos leads em que está atualmente direcionado pelo Rotas;
- possibilidade de compartilhar o mesmo lead com outros vendedores responsáveis;
- movimentação das etapas;
- nome comercial e setor do lead;
- observações e histórico;
- métricas de acompanhamento sem acesso ao conteúdo das mensagens.

O vendedor não recebe políticas para WhatsApps, contatos brutos, conversas, mensagens, mídias ou auditoria.

## Jornada comercial

O `Odontoart-rotas` continua sendo a fonte oficial de empresas, visitas e vendedores. O Mirror não cria, conclui ou altera visitas/rotas.

Fluxo principal:

1. Mirror sincroniza vendedores com role `VENDEDOR`, empresas e visitas do Rotas.
2. Telefones são normalizados e comparados com os contatos espelhados do WhatsApp.
3. Quando uma empresa possui visita concluída, o relacionamento elegível aparece no Kanban.
4. Os vendedores responsáveis são derivados automaticamente da data de visita mais recente até o dia atual.
5. Se dois ou mais vendedores estiverem direcionados para a mesma empresa nessa data, todos recebem o mesmo card compartilhado.
6. Quando o direcionamento muda, os responsáveis atuais são substituídos sem reiniciar a etapa do lead; os períodos anteriores permanecem no histórico.
7. Se o telefone não corresponder com segurança a uma única empresa, o contato permanece na fila administrativa de vínculo manual. Mesmo nesse caso, vendedores continuam sendo definidos pelo Rotas.

A identificação comercial do card (`Vulcabras - RH`, por exemplo) pertence ao Mirror e nunca altera o nome oficial da empresa no Rotas.

## Métricas pós-visita

O Mirror calcula dados derivados sem expor mensagens aos vendedores:

- última visita concluída;
- primeira interação após a visita;
- tempo visita → follow-up;
- última interação;
- total de interações após a visita;
- recebidas e enviadas;
- dias sem interação;
- lead visitado sem follow-up;
- temperatura: quente, morno, frio, parado ou sem leitura.

## Acesso dos vendedores

Os vendedores são sincronizados a partir do Rotas. O e-mail é usado na experiência de login, enquanto o vínculo interno usa o identificador estável do usuário do Rotas.

A senha do Rotas não é copiada. O vendedor solicita um magic link pelo próprio e-mail e entra diretamente em `/kanban`.

Para produção, inclua a URL pública do Mirror nas URLs de redirecionamento permitidas do Supabase Auth para que o magic link possa retornar a `/kanban`.

## Regra read-only do WhatsApp e do Rotas

O backend do WhatsApp não expõe operação de envio, resposta, reação, edição ou exclusão de mensagem. A integração continua dedicada à leitura/sincronização.

O cliente do Rotas fica exclusivamente no backend do Mirror e contém apenas consultas de leitura. O repositório `Odontoart-rotas` não é alterado por esta integração.

## Requisitos

- Node.js 20+ ou 22 LTS;
- npm;
- projeto Supabase do Mirror com Auth, PostgreSQL, Storage e Realtime;
- ambiente capaz de executar Chromium/Puppeteer;
- usuário administrador no Supabase Auth com `public.profiles.role = 'admin'` e `active = true`;
- credenciais server-side para leitura do projeto Rotas.

> A conexão por QR Code usa `whatsapp-web.js`, que se conecta ao WhatsApp Web e não é a API oficial Meta Cloud. Mudanças no WhatsApp Web podem exigir atualização da biblioteca.

## Instalação

```bash
npm install
copy .env.example .env
```

No Linux use `cp .env.example .env`.

Preencha as variáveis do Supabase do Mirror e, no backend, as variáveis do Rotas:

```env
ROTAS_SUPABASE_URL=
ROTAS_SUPABASE_SERVICE_ROLE_KEY=
ROTAS_SYNC_INTERVAL_SECONDS=300
```

Essas credenciais nunca devem ser expostas como variáveis `VITE_*`.

## Banco

Execute as migrations de `supabase/migrations` na ordem cronológica. Além do schema original, as migrations `20260814*` adicionam o módulo comercial, RLS, histórico de responsáveis, fila de vínculos e regras de ativação pós-visita.

O bucket `whatsapp-media` permanece privado.

## Primeiro administrador

1. Crie o usuário no Supabase Auth.
2. Copie o UUID.
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

Se o servidor já possuir Chrome/Chromium compatível, configure `PUPPETEER_EXECUTABLE_PATH`.

## Histórico do WhatsApp

`WHATSAPP_HISTORY_LIMIT` define quantas mensagens por conversa são importadas em cada sincronização manual/inicial. O padrão é 100 e o limite aceito é 500.
