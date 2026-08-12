# Provider WhatsApp

`WhatsAppReadOnlyProvider` define somente criação/encerramento de sessão, QR, status, chats, mensagens, contatos e mídia. A aplicação não depende de uma biblioteca específica.

O adapter demonstrativo retorna estados vazios. Antes de implementá-lo com uma biblioteca Multi-Device, valide a documentação corrente, o licenciamento, persistência de sessão, suporte a múltiplas contas, eventos de mídia e reconexão. O adapter deve normalizar eventos para os tipos internos e deduplicar por `external_message_id` antes de persistir.

Não adicione operações de envio, reação, edição, exclusão, presença, digitação ou leitura automática. Abrir uma conversa no painel não deve produzir efeitos no celular do cliente.
