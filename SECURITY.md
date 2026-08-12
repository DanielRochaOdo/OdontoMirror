# Segurança

- Supabase Auth autentica administradores; RLS exige perfil ativo com role `admin`.
- O backend valida o JWT do Supabase em toda rota `/api/whatsapp/*`.
- A service role permanece exclusivamente no backend.
- CORS permite somente `FRONTEND_URL`; Helmet e rate limit estão habilitados.
- Storage `whatsapp-media` é privado e o frontend recebe apenas signed URLs temporárias.
- Logs técnicos registram IDs e erros operacionais, nunca texto completo das mensagens, mídia, token, QR ou credenciais.
- O frontend não possui caixa de resposta, ações de envio, chamadas ou presença.
- O provider não expõe métodos capazes de enviar ou modificar mensagens.
- Eventos de auditoria são gravados por uma função `security definer` que deriva `admin_id` de `auth.uid()`; o frontend não escolhe o administrador do log.
- Sessões locais do WhatsApp e arquivos `.env` são ignorados pelo Git.
