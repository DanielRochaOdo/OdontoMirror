export type WhatsAppStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'qr_required' | 'error';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';
export type UserRole = 'admin' | 'seller';
export type LeadTemperature = 'hot' | 'warm' | 'cold' | 'stopped' | 'unknown';

export interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber: string;
  description?: string;
  profileName?: string;
  profilePictureUrl?: string;
  status: WhatsAppStatus;
  connected: boolean;
  conversationCount: number;
  lastSyncAt?: string;
  lastMessageAt?: string;
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
  lastMessageAt?: string;
  lastMessagePreview: string;
  messageCount: number;
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
  whatsappAccountName?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  active: boolean;
  rotasUserId?: string;
  email?: string;
}

export type AdminProfile = UserProfile;

export interface KanbanStatus {
  id: string;
  name: string;
  slug: string;
  position: number;
  colorKey: string;
  active: boolean;
  isTerminal: boolean;
}

export interface CommercialVendor {
  id: string;
  rotasUserId: string;
  name: string;
  email?: string;
  active: boolean;
}

export interface CommercialCompany {
  id: string;
  rotasClienteId: string;
  companyCode?: string;
  companyName: string;
  tradeName?: string;
  contactName?: string;
  status?: string;
  category?: string;
  groupName?: string;
  city?: string;
  district?: string;
  uf?: string;
  lastVisitAt?: string;
}

export interface CommercialLeadAssignment {
  id: string;
  vendor: CommercialVendor;
  source: 'route' | 'manual';
  sourceVisitDate?: string;
  startedAt: string;
}

export interface CommercialLeadMetrics {
  lastVisitAt?: string;
  firstInteractionAfterVisitAt?: string;
  lastInteractionAt?: string;
  interactionCountAfterVisit: number;
  inboundCountAfterVisit: number;
  outboundCountAfterVisit: number;
  followupDelayMinutes?: number;
  daysWithoutInteraction?: number;
  noFollowup: boolean;
  temperature: LeadTemperature;
}

export interface CommercialLead {
  id: string;
  company: CommercialCompany;
  displayName: string;
  department?: string;
  contactName?: string;
  contactPhone?: string;
  linkedPhoneNormalized?: string;
  statusId: string;
  linkSource: 'automatic' | 'manual';
  lastStatusChangedAt: string;
  assignments: CommercialLeadAssignment[];
  metrics: CommercialLeadMetrics;
}

export interface CommercialLeadStatusHistory {
  id: string;
  leadId: string;
  fromStatusId?: string;
  toStatusId: string;
  changedByName?: string;
  changedByRole?: string;
  createdAt: string;
}

export interface CommercialLeadNote {
  id: string;
  leadId: string;
  authorName?: string;
  note: string;
  createdAt: string;
}

export interface CommercialSyncRun {
  id: string;
  status: 'running' | 'success' | 'error';
  startedAt: string;
  finishedAt?: string;
  vendorsSynced: number;
  companiesSynced: number;
  visitsSynced: number;
  leadsLinked: number;
  assignmentsChanged: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
}
