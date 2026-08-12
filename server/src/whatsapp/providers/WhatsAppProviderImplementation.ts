import type { WhatsAppReadOnlyProvider, ProviderChat, ProviderMessage } from '../types.js';
import type { WhatsAppStatus } from '../../types/domain.js';

/**
 * Integration boundary. A real provider adapter belongs here after its current
 * documentation and licensing are reviewed. No write or presence methods are
 * intentionally exposed by this class.
 */
export class WhatsAppProviderImplementation implements WhatsAppReadOnlyProvider {
  private readonly statuses = new Map<string, WhatsAppStatus>();
  async createSession(accountId: string) { this.statuses.set(accountId, 'qr_required'); }
  async generateQRCode(_accountId: string) { return null; }
  async disconnectSession(accountId: string) { this.statuses.set(accountId, 'disconnected'); }
  async getConnectionStatus(accountId: string) { return this.statuses.get(accountId) ?? 'disconnected'; }
  async getChats(_accountId: string): Promise<ProviderChat[]> { return []; }
  async getMessages(_accountId: string, _chatId: string): Promise<ProviderMessage[]> { return []; }
  async getContacts(_accountId: string) { return []; }
  async getMedia(_messageId: string) { return null; }
}
