import { supabase } from './supabase';

const apiUrl = (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3333').replace(/\/$/, '');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sessão administrativa expirada.');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(`Backend indisponível em ${apiUrl}. Confirme se o comando npm run dev está ativo na raiz do projeto.`);
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
