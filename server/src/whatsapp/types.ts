import type { WhatsAppStatus } from '../types/domain.js';

export interface ProviderChat { externalChatId: string; name: string; phone?: string; lastMessageAt?: string; lastMessagePreview?: string; }
export interface ProviderMessage { externalMessageId: string; externalChatId: string; senderPhone: string; senderName?: string; direction: 'inbound' | 'outbound'; messageType: 'text' | 'image' | 'audio' | 'video' | 'document'; textContent?: string; sentAt: string; }
export interface WhatsAppReadOnlyProvider {
  restoreSessions(): Promise<void>;
  createSession(accountId: string): Promise<void>;
  generateQRCode(accountId: string): Promise<string | null>;
  disconnectSession(accountId: string): Promise<void>;
  removeSession(accountId: string): Promise<void>;
  getConnectionStatus(accountId: string): Promise<WhatsAppStatus>;
  syncAccount(accountId: string): Promise<void>;
  getChats(accountId: string): Promise<ProviderChat[]>;
  getMessages(accountId: string, chatId: string): Promise<ProviderMessage[]>;
  getContacts(accountId: string): Promise<Array<{ externalContactId: string; name: string; phone: string }>>;
}
