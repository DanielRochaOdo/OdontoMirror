export type WhatsAppStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'qr_required' | 'error';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber: string;
  description?: string;
  profileName: string;
  profilePictureUrl?: string;
  status: WhatsAppStatus;
  connected: boolean;
  conversationCount: number;
  lastSyncAt: string;
  lastMessageAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  profilePictureUrl?: string;
}

export interface Conversation {
  id: string;
  whatsappAccountId: string;
  contact: Contact;
  conversationType: 'individual' | 'group';
  lastMessageAt: string;
  lastMessagePreview: string;
  messageCount: number;
  unread?: number;
  lastMessageType?: MessageType;
}

export interface MediaFile {
  id: string;
  mediaType: Exclude<MessageType, 'text'>;
  mimeType: string;
  fileName: string;
  fileSize: number;
  url?: string;
  duration?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  whatsappAccountId: string;
  senderPhone: string;
  senderName: string;
  direction: MessageDirection;
  messageType: MessageType;
  textContent?: string;
  sentAt: string;
  media?: MediaFile;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string;
  adminName: string;
  createdAt: string;
  metadata?: string;
}
