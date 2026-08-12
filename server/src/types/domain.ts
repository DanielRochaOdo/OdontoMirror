export type WhatsAppStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'qr_required' | 'error';
export interface WhatsAppAccount { id: string; name: string; phoneNumber: string; status: WhatsAppStatus; connected: boolean; }
export interface ProviderSessionStatus { accountId: string; status: WhatsAppStatus; qrCode?: string; connectedAt?: string; }
