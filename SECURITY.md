# Segurança

- Supabase Auth autentica administradores; RLS exige perfil ativo com role `admin`.
- Service role permanece exclusivamente no backend.
- CORS permite apenas `FRONTEND_URL`; Helmet e rate limit estão habilitados.
- Storage `whatsapp-media` é privado. Use signed URLs de 60–300 segundos para mídia.
- Logs devem registrar IDs, evento, duração e sucesso; nunca conteúdo de mensagens, mídia, tokens, QR ou credenciais.
- As telas não renderizam caixa de resposta, ações de mensagem ou funções de presença.
- Audite LOGIN, LOGOUT, VIEW_ACCOUNT, VIEW_CONVERSATION e visualizações/downloads de mídia.

Antes de produção, substituir o login demonstrativo por `supabase.auth.signInWithPassword`, aplicar a migration e conectar o repositório às consultas Supabase com RLS.
