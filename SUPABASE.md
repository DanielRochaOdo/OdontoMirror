# Supabase

A migration inicial cria `profiles`, `whatsapp_accounts`, `whatsapp_sessions`, `contacts`, `conversations`, `messages`, `media_files` e `audit_logs`, além dos índices pedidos pelo domínio.

O trigger de criação de perfil pode ser adicionado em uma migration posterior quando o fluxo de onboarding estiver definido. O backend deve usar a service role somente para ingestão/sincronização; consultas administrativas do frontend usam a anon key e a sessão Auth.

Realtime deve ser habilitado para `whatsapp_accounts`, `conversations` e `messages`. Ao receber mudanças, invalide as queries `['conversations', accountId]` e `['messages', accountId, conversationId]`.
