import type { WhatsAppReadOnlyProvider } from './types.js';

export type SyncStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface SyncProgress {
  accountId: string;
  status: SyncStatus;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

function idleProgress(accountId: string): SyncProgress {
  return {
    accountId,
    status: 'idle',
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };
}

export class WhatsAppSessionManager {
  private readonly syncProgress = new Map<string, SyncProgress>();
  private readonly syncTasks = new Map<string, Promise<void>>();

  constructor(private readonly provider: WhatsAppReadOnlyProvider) {}

  async restore() { await this.provider.restoreSessions(); }
  async create(accountId: string) { await this.provider.createSession(accountId); return this.provider.getConnectionStatus(accountId); }
  async disconnect(accountId: string) { await this.provider.disconnectSession(accountId); return this.provider.getConnectionStatus(accountId); }
  async remove(accountId: string) {
    await this.provider.removeSession(accountId);
    this.syncProgress.delete(accountId);
    this.syncTasks.delete(accountId);
  }
  async status(accountId: string) { return this.provider.getConnectionStatus(accountId); }
  async qr(accountId: string) { return this.provider.generateQRCode(accountId); }

  getSyncProgress(accountId: string) {
    return this.syncProgress.get(accountId) ?? idleProgress(accountId);
  }

  async sync(accountId: string) {
    return this.startSync(accountId);
  }

  async startSync(accountId: string) {
    const existingTask = this.syncTasks.get(accountId);
    if (existingTask) return this.getSyncProgress(accountId);

    const connectionStatus = await this.provider.getConnectionStatus(accountId);
    if (connectionStatus !== 'connected') {
      const error = new Error(`WhatsApp não está conectado. Status atual: ${connectionStatus}.`);
      Object.assign(error, { statusCode: 409 });
      throw error;
    }

    const now = new Date().toISOString();
    this.syncProgress.set(accountId, {
      accountId,
      status: 'running',
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      error: null,
    });

    const task = this.runSync(accountId);
    this.syncTasks.set(accountId, task);
    void task.finally(() => this.syncTasks.delete(accountId));
    return this.getSyncProgress(accountId);
  }

  private async runSync(accountId: string) {
    try {
      await this.provider.syncAccount(accountId);
      const now = new Date().toISOString();
      const current = this.getSyncProgress(accountId);
      this.syncProgress.set(accountId, {
        ...current,
        status: 'completed',
        updatedAt: now,
        completedAt: now,
        error: null,
      });
    } catch (cause) {
      const now = new Date().toISOString();
      const current = this.getSyncProgress(accountId);
      const message = cause instanceof Error ? cause.message : 'Falha desconhecida durante a sincronização.';
      this.syncProgress.set(accountId, {
        ...current,
        status: 'failed',
        updatedAt: now,
        completedAt: now,
        error: message,
      });
    }
  }
}
