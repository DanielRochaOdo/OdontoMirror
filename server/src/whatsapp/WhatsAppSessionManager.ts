import type { WhatsAppReadOnlyProvider } from './types.js';

export class WhatsAppSessionManager {
  constructor(private readonly provider: WhatsAppReadOnlyProvider) {}
  async restore() { await this.provider.restoreSessions(); }
  async create(accountId: string) { await this.provider.createSession(accountId); return this.provider.getConnectionStatus(accountId); }
  async disconnect(accountId: string) { await this.provider.disconnectSession(accountId); return this.provider.getConnectionStatus(accountId); }
  async remove(accountId: string) { await this.provider.removeSession(accountId); }
  async status(accountId: string) { return this.provider.getConnectionStatus(accountId); }
  async qr(accountId: string) { return this.provider.generateQRCode(accountId); }
  async sync(accountId: string) { return this.provider.syncAccount(accountId); }
}
