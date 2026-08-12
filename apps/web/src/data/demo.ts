import type { AuditLog, Conversation, Message, WhatsAppAccount } from '../types';

export const accounts: WhatsAppAccount[] = [
  {
    id: 'sac', name: 'SAC', phoneNumber: '(85) 3292-4444', profileName: 'MirrorDesk SAC',
    description: 'Atendimento e relacionamento com clientes', status: 'connected', connected: true,
    conversationCount: 153, lastSyncAt: '2026-08-12T16:34:00-03:00', lastMessageAt: '2026-08-12T16:32:00-03:00',
  },
  {
    id: 'financeiro', name: 'Financeiro', phoneNumber: '(85) 99999-1111', profileName: 'MirrorDesk Financeiro',
    description: 'Cobrança, pagamentos e contratos', status: 'connected', connected: true,
    conversationCount: 87, lastSyncAt: '2026-08-12T16:29:00-03:00', lastMessageAt: '2026-08-12T16:28:00-03:00',
  },
  {
    id: 'comercial', name: 'Comercial', phoneNumber: '(85) 99999-2222', profileName: 'MirrorDesk Comercial',
    description: 'Novos negócios e parcerias', status: 'disconnected', connected: false,
    conversationCount: 249, lastSyncAt: '2026-08-11T11:04:00-03:00', lastMessageAt: '2026-08-11T11:04:00-03:00',
  },
];

const contacts = [
  { id: 'joao', name: 'João da Silva', phone: '(85) 99812-3010' },
  { id: 'maria', name: 'Maria Oliveira', phone: '(85) 99745-2268' },
  { id: 'pedro', name: 'Pedro Henrique', phone: '(85) 99601-3488' },
  { id: 'clinica', name: 'Clínica Vitta', phone: '(85) 3232-1100' },
  { id: 'ana', name: 'Ana Beatriz Costa', phone: '(85) 99183-4471' },
];

export const conversations: Conversation[] = accounts.flatMap((account) => contacts.map((contact, index) => ({
  id: `${account.id}-${contact.id}`,
  whatsappAccountId: account.id,
  contact,
  conversationType: contact.id === 'clinica' ? 'group' : 'individual',
  lastMessageAt: new Date(Date.UTC(2026, 7, 12, 16 - index, 27)).toISOString(),
  lastMessagePreview: ['Gostaria de saber sobre meu plano...', 'Enviei os documentos para análise.', 'Perfeito, aguardo o retorno.', 'Reunião confirmada para amanhã.', 'Pode me confirmar o prazo?'][index] ?? 'Sem prévia disponível',
  messageCount: 18 + index * 7,
  unread: index === 0 ? 2 : 0,
  lastMessageType: index === 2 ? 'document' : 'text',
})));

export const messages: Message[] = [
  { id: 'm1', conversationId: 'sac-joao', whatsappAccountId: 'sac', senderPhone: '(85) 99812-3010', senderName: 'João da Silva', direction: 'inbound', messageType: 'text', textContent: 'Olá, boa tarde. Gostaria de saber sobre meu plano odontológico.', sentAt: '2026-08-12T16:18:00-03:00' },
  { id: 'm2', conversationId: 'sac-joao', whatsappAccountId: 'sac', senderPhone: '(85) 3292-4444', senderName: 'SAC', direction: 'outbound', messageType: 'text', textContent: 'Boa tarde, João! Vou consultar os detalhes do seu cadastro.', sentAt: '2026-08-12T16:20:00-03:00' },
  { id: 'm3', conversationId: 'sac-joao', whatsappAccountId: 'sac', senderPhone: '(85) 99812-3010', senderName: 'João da Silva', direction: 'inbound', messageType: 'text', textContent: 'Tudo bem, fico no aguardo. É sobre a cobertura de limpeza.', sentAt: '2026-08-12T16:27:00-03:00' },
  { id: 'm4', conversationId: 'sac-joao', whatsappAccountId: 'sac', senderPhone: '(85) 3292-4444', senderName: 'SAC', direction: 'outbound', messageType: 'document', textContent: 'Segue o material que foi enviado anteriormente para referência.', sentAt: '2026-08-12T16:30:00-03:00', media: { id: 'doc1', mediaType: 'document', mimeType: 'application/pdf', fileName: 'guia-de-cobertura.pdf', fileSize: 248000 } },
  { id: 'm5', conversationId: 'sac-joao', whatsappAccountId: 'sac', senderPhone: '(85) 99812-3010', senderName: 'João da Silva', direction: 'inbound', messageType: 'image', textContent: 'Obrigado! Também encaminho a carteirinha atualizada.', sentAt: '2026-08-12T16:32:00-03:00', media: { id: 'img1', mediaType: 'image', mimeType: 'image/jpeg', fileName: 'carteirinha.jpg', fileSize: 486000, url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=900&q=80' } },
];

export const auditLogs: AuditLog[] = [
  { id: 'a1', action: 'VIEW_CONVERSATION', entityType: 'conversation', entityLabel: 'João da Silva · SAC', adminName: 'Daniel Rocha', createdAt: '2026-08-12T16:32:00-03:00' },
  { id: 'a2', action: 'VIEW_ACCOUNT', entityType: 'whatsapp_account', entityLabel: 'SAC · (85) 3292-4444', adminName: 'Daniel Rocha', createdAt: '2026-08-12T16:28:00-03:00' },
  { id: 'a3', action: 'LOGIN', entityType: 'session', entityLabel: 'Sessão administrativa', adminName: 'Daniel Rocha', createdAt: '2026-08-12T16:25:00-03:00' },
  { id: 'a4', action: 'VIEW_DOCUMENT', entityType: 'media_file', entityLabel: 'guia-de-cobertura.pdf', adminName: 'Daniel Rocha', createdAt: '2026-08-11T11:41:00-03:00' },
  { id: 'a5', action: 'GENERATE_QR', entityType: 'whatsapp_account', entityLabel: 'Comercial · (85) 99999-2222', adminName: 'Daniel Rocha', createdAt: '2026-08-11T10:15:00-03:00' },
];
