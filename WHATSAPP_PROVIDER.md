# Provider WhatsApp

A implementação atual usa `whatsapp-web.js` com `LocalAuth`, uma sessão isolada por `whatsapp_account_id` e persistência local sob `WHATSAPP_SESSION_PATH`.

## Operações expostas ao restante do backend

- criar/inicializar sessão;
- obter QR Code;
- consultar status;
- desconectar/remover sessão;
- sincronizar chats, contatos, mensagens e mídias;
- consultar chats/mensagens/contatos para diagnóstico do provider.

Não há métodos de envio, resposta, encaminhamento, reação, edição, exclusão de mensagens ou alteração de presença.

## Eventos observados

- QR e autenticação para o ciclo de conexão;
- estado `ready` para marcar a conta como conectada e iniciar sincronização;
- mensagens recebidas;
- mensagens criadas pelo próprio dispositivo corporativo, apenas para espelhamento do histórico;
- falha de autenticação e desconexão.

## Mídias

Ao observar uma mensagem com mídia, o backend baixa o conteúdo, grava no bucket privado `whatsapp-media`, registra metadados em `media_files` e associa a mídia à mensagem. O caminho usa apenas UUIDs; o nome original do arquivo fica apenas no metadado do banco.
