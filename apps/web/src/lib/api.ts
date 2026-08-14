import { supabase } from './supabase';

const apiUrl = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3333').replace(/\/$/, '');
const isNgrokFreeEndpoint = apiUrl.includes('.ngrok-free.app') || apiUrl.includes('.ngrok-free.dev');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão expirada.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (isNgrokFreeEndpoint) headers.set('ngrok-skip-browser-warning', '1');
  if (init.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(`Não foi possível conectar à API do OdontoMirror em ${apiUrl}.`);
  }

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.message === 'string' ? payload.message : typeof payload.error === 'string' ? payload.error : `Falha na API (HTTP ${response.status}).`);
  }
  return payload as T;
}

export interface CreatedWhatsAppAccount {
  accountId: string;
  name: string;
  description?: string;
  status: string;
}

export interface SyncProgress {
  accountId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface ApiHealth {
  ok: boolean;
  service: string;
  readOnly: boolean;
  timestamp: string;
}

export interface CommercialSyncResult {
  runId: string;
  vendorsSynced: number;
  companiesSynced: number;
  visitsSynced: number;
  leadsLinked: number;
  assignmentsChanged: number;
  ambiguousPhones: number;
}

export interface CommercialSyncStatus {
  configured: boolean;
  runs: Array<{
    id: string;
    status: 'running' | 'success' | 'error';
    started_at: string;
    finished_at: string | null;
    vendors_synced: number;
    companies_synced: number;
    visits_synced: number;
    leads_linked: number;
    assignments_changed: number;
    error_message: string | null;
    metadata: Record<string, unknown>;
  }>;
}

export const whatsappApi = {
  createAccount: (body: { name: string; description?: string }) => request<CreatedWhatsAppAccount>('/api/whatsapp/accounts', { method: 'POST', body: JSON.stringify(body) }),
  connect: (accountId: string) => request<{ accountId: string; status: string }>(`/api/whatsapp/${accountId}/connect`, { method: 'POST' }),
  disconnect: (accountId: string) => request<{ accountId: string; status: string }>(`/api/whatsapp/${accountId}/disconnect`, { method: 'POST' }),
  remove: (accountId: string) => request<{ removed: boolean }>(`/api/whatsapp/${accountId}`, { method: 'DELETE' }),
  sync: (accountId: string) => request<{ accepted: boolean }>(`/api/whatsapp/${accountId}/sync`, { method: 'POST' }),
  syncStatus: (accountId: string) => request<SyncProgress>(`/api/sync/${accountId}/status`),
  status: (accountId: string) => request<{ accountId: string; status: string }>(`/api/whatsapp/${accountId}/status`),
  qr: (accountId: string) => request<{ accountId: string; qrCode: string | null }>(`/api/whatsapp/${accountId}/qr`),
  health: () => request<ApiHealth>('/health'),
};

export const commercialApi = {
  sync: () => request<CommercialSyncResult>('/api/commercial/sync', { method: 'POST' }),
  syncStatus: () => request<CommercialSyncStatus>('/api/commercial/sync/status'),
};
