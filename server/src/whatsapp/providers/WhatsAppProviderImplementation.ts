import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import QRCode from 'qrcode';
import whatsapp from 'whatsapp-web.js';
import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../supabase/admin.js';
import type { WhatsAppStatus } from '../../types/domain.js';
import type { ProviderChat, ProviderMessage, WhatsAppReadOnlyProvider } from '../types.js';

const { Client, LocalAuth } = whatsapp;
type WWebClient = InstanceType<typeof Client>;
type WWebChat = Awaited<ReturnType<WWebClient['getChats']>>[number];
type WWebMessage = Awaited<ReturnType<WWebChat['fetchMessages']>>[number];

interface RuntimeSession {
  client: WWebClient;
  status: WhatsAppStatus;
  qrCode: string | null;
}

export class WhatsAppProviderImplementation implements WhatsAppReadOnlyProvider {
  private readonly sessions = new Map<string, RuntimeSession>();

  async restoreSessions() {
    const { data, error } = await supabaseAdmin.from('whatsapp_accounts').select('id,status').neq('status', 'disconnected');
    if (error) throw error;
    for (const account of data ?? []) {
      try { await this.createSession(account.id); }
      catch (cause) { console.error({ accountId: account.id, event: 'restore_failed', error: cause instanceof Error ? cause.message : String(cause) }); }
    }
  }

  async createSession(accountId: string) {
    const existing = this.sessions.get(accountId);
    if (existing && ['connected', 'connecting', 'qr_required', 'reconnecting'].includes(existing.status)) return;
    if (existing) {
      await existing.client.destroy().catch(() => undefined);
      this.sessions.delete(accountId);
    }

    const puppeteer = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      ...(env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: env.PUPPETEER_EXECUTABLE_PATH } : {}),
    };
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: accountId, dataPath: env.WHATSAPP_SESSION_PATH }),
      puppeteer,
    });
    const runtime: RuntimeSession = { client, status: 'connecting', qrCode: null };
    this.sessions.set(accountId, runtime);
    await this.updateStatus(accountId, 'connecting');

    client.on('qr', async (rawQr) => {
      runtime.qrCode = await QRCode.toDataURL(rawQr, { margin: 1, width: 300 });
      runtime.status = 'qr_required';
      await this.updateStatus(accountId, 'qr_required');
    });
    client.on('authenticated', async () => {
      runtime.status = 'connecting';
      await this.updateStatus(accountId, 'connecting');
    });
    client.on('ready', async () => {
      runtime.status = 'connected';
      runtime.qrCode = null;
      const phoneNumber = client.info?.wid?.user ?? '';
      const profileName = client.info?.pushname ?? null;
      let profilePictureUrl: string | null = null;
      try { profilePictureUrl = await client.getProfilePicUrl(client.info.wid._serialized); } catch { profilePictureUrl = null; }
      await supabaseAdmin.from('whatsapp_accounts').update({
        phone_number: phoneNumber,
        profile_name: profileName,
        profile_picture_url: profilePictureUrl,
        status: 'connected',
        connected: true,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', accountId);
      await this.upsertSessionRow(accountId, 'connected', true);
      void this.syncAccount(accountId).catch((error: unknown) => console.error({ accountId, event: 'initial_sync_failed', error: error instanceof Error ? error.message : String(error) }));
    });
    client.on('auth_failure', async () => {
      runtime.status = 'error';
      runtime.qrCode = null;
      await this.updateStatus(accountId, 'error');
    });
    client.on('disconnected', async () => {
      runtime.status = 'disconnected';
      runtime.qrCode = null;
      await this.updateStatus(accountId, 'disconnected');
    });
    client.on('message', (message) => {
      void this.persistMessage(accountId, message).catch((error: unknown) => console.error({ accountId, event: 'incoming_persist_failed', error: error instanceof Error ? error.message : String(error) }));
    });
    client.on('message_create', (message) => {
      if (!message.fromMe) return;
      void this.persistMessage(accountId, message).catch((error: unknown) => console.error({ accountId, event: 'outgoing_observe_failed', error: error instanceof Error ? error.message : String(error) }));
    });

    void client.initialize().catch(async (error: unknown) => {
      runtime.status = 'error';
      await this.updateStatus(accountId, 'error');
      console.error({ accountId, event: 'initialize_failed', error: error instanceof Error ? error.message : String(error) });
    });
  }

  async generateQRCode(accountId: string) { return this.sessions.get(accountId)?.qrCode ?? null; }

  async disconnectSession(accountId: string) {
    const runtime = this.sessions.get(accountId);
    if (runtime) await runtime.client.destroy().catch(() => undefined);
    this.sessions.delete(accountId);
    await this.updateStatus(accountId, 'disconnected');
  }

  async removeSession(accountId: string) {
    await this.disconnectSession(accountId);
    await rm(join(env.WHATSAPP_SESSION_PATH, `session-${accountId}`), { recursive: true, force: true }).catch(() => undefined);
  }

  async getConnectionStatus(accountId: string): Promise<WhatsAppStatus> {
    const runtime = this.sessions.get(accountId);
    if (runtime) return runtime.status;
    const { data } = await supabaseAdmin.from('whatsapp_accounts').select('status').eq('id', accountId).maybeSingle();
    return (data?.status as WhatsAppStatus | undefined) ?? 'disconnected';
  }

  async syncAccount(accountId: string) {
    const runtime = this.sessions.get(accountId);
    if (!runtime || runtime.status !== 'connected') throw new Error('WhatsApp não está conectado.');
    const chats = await runtime.client.getChats();
    for (const chat of chats) {
      if (chat.id._serialized === 'status@broadcast') continue;
      const conversationId = await this.ensureConversation(accountId, chat);
      const history = await chat.fetchMessages({ limit: env.WHATSAPP_HISTORY_LIMIT });
      for (const message of history) await this.persistMessage(accountId, message, conversationId);
    }
    await supabaseAdmin.from('whatsapp_accounts').update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', accountId);
  }

  async getChats(accountId: string): Promise<ProviderChat[]> {
    const client = this.requireConnectedClient(accountId);
    const chats = await client.getChats();
    return chats.filter((chat) => chat.id._serialized !== 'status@broadcast').map((chat) => ({
      externalChatId: chat.id._serialized,
      name: chat.name || chat.id.user,
      phone: chat.id.user,
      lastMessageAt: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : undefined,
      lastMessagePreview: chat.lastMessage?.body || undefined,
    }));
  }

  async getMessages(accountId: string, chatId: string): Promise<ProviderMessage[]> {
    const client = this.requireConnectedClient(accountId);
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: env.WHATSAPP_HISTORY_LIMIT });
    return messages.map((message) => this.normalizeMessage(message, client.info?.wid?.user));
  }

  async getContacts(accountId: string) {
    const client = this.requireConnectedClient(accountId);
    const contacts = await client.getContacts();
    return contacts.filter((contact) => !contact.isGroup).map((contact) => ({
      externalContactId: contact.id._serialized,
      name: contact.pushname || contact.name || contact.id.user,
      phone: contact.id.user,
    }));
  }

  private requireConnectedClient(accountId: string) {
    const runtime = this.sessions.get(accountId);
    if (!runtime || runtime.status !== 'connected') throw new Error('WhatsApp não está conectado.');
    return runtime.client;
  }

  private normalizeMessage(message: WWebMessage, ownPhone?: string): ProviderMessage {
    const externalChatId = message.fromMe ? message.to : message.from;
    const sender = message.fromMe ? (ownPhone ?? message.to) : (message.author ?? message.from);
    return {
      externalMessageId: message.id._serialized,
      externalChatId,
      senderPhone: sender.split('@')[0] ?? sender,
      direction: message.fromMe ? 'outbound' : 'inbound',
      messageType: this.mapMessageType(message.type),
      textContent: message.body || undefined,
      sentAt: new Date(message.timestamp * 1000).toISOString(),
    };
  }

  private async ensureConversation(accountId: string, chat: WWebChat) {
    let contactId: string | null = null;
    let name = chat.name || chat.id.user;
    if (!chat.isGroup) {
      try {
        const contact = await chat.getContact();
        name = contact.pushname || contact.name || name;
        let picture: string | null = null;
        try { picture = await contact.getProfilePicUrl(); } catch { picture = null; }
        const { data: savedContact, error } = await supabaseAdmin.from('contacts').upsert({
          whatsapp_account_id: accountId,
          external_contact_id: contact.id._serialized,
          name,
          phone: contact.id.user,
          profile_picture_url: picture,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'whatsapp_account_id,external_contact_id' }).select('id').single();
        if (error) throw error;
        contactId = savedContact.id;
      } catch (error) {
        console.warn({ accountId, chatId: chat.id._serialized, event: 'contact_sync_skipped', error: error instanceof Error ? error.message : String(error) });
      }
    }
    const { data: conversation, error } = await supabaseAdmin.from('conversations').upsert({
      whatsapp_account_id: accountId,
      contact_id: contactId,
      external_chat_id: chat.id._serialized,
      conversation_type: chat.isGroup ? 'group' : 'individual',
      name,
      last_message_at: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : null,
      last_message_preview: chat.lastMessage?.body?.slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'whatsapp_account_id,external_chat_id' }).select('id').single();
    if (error) throw error;
    return conversation.id as string;
  }

  private async persistMessage(accountId: string, message: WWebMessage, knownConversationId?: string) {
    if (!message.id?._serialized) return;
    const { data: existing } = await supabaseAdmin.from('messages').select('id').eq('external_message_id', message.id._serialized).maybeSingle();
    if (existing) return;
    const client = this.requireConnectedClient(accountId);
    const chat = await message.getChat();
    const conversationId = knownConversationId ?? await this.ensureConversation(accountId, chat);
    let senderName: string | null = null;
    if (message.fromMe) senderName = client.info?.pushname ?? 'Corporativo';
    else {
      try { const contact = await message.getContact(); senderName = contact.pushname || contact.name || null; } catch { senderName = null; }
    }
    const normalized = this.normalizeMessage(message, client.info?.wid?.user);
    const { data: inserted, error } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      whatsapp_account_id: accountId,
      external_message_id: normalized.externalMessageId,
      sender_phone: normalized.senderPhone,
      sender_name: senderName,
      direction: normalized.direction,
      message_type: normalized.messageType,
      text_content: normalized.textContent ?? null,
      sent_at: normalized.sentAt,
      metadata: { external_type: message.type, has_media: message.hasMedia },
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return;
      throw error;
    }

    if (message.hasMedia) {
      try {
        const media = await message.downloadMedia();
        if (media?.data) {
          const mimeType = media.mimetype || 'application/octet-stream';
          const extension = this.extensionFor(mimeType, media.filename);
          const storagePath = `${accountId}/${conversationId}/${inserted.id}.${extension}`;
          const buffer = Buffer.from(media.data, 'base64');
          const { error: uploadError } = await supabaseAdmin.storage.from('whatsapp-media').upload(storagePath, buffer, { contentType: mimeType, upsert: true });
          if (uploadError) throw uploadError;
          const { data: mediaRow, error: mediaError } = await supabaseAdmin.from('media_files').insert({
            message_id: inserted.id,
            media_type: normalized.messageType === 'text' ? 'document' : normalized.messageType,
            mime_type: mimeType,
            file_name: media.filename || `arquivo.${extension}`,
            file_size: buffer.length,
            storage_path: storagePath,
          }).select('id').single();
          if (mediaError) throw mediaError;
          await supabaseAdmin.from('messages').update({ media_id: mediaRow.id }).eq('id', inserted.id);
        }
      } catch (error) {
        console.warn({ accountId, messageId: inserted.id, event: 'media_sync_failed', error: error instanceof Error ? error.message : String(error) });
      }
    }

    const { count } = await supabaseAdmin.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversationId);
    const preview = normalized.textContent?.slice(0, 300) || this.previewFor(normalized.messageType);
    await supabaseAdmin.from('conversations').update({ last_message_at: normalized.sentAt, last_message_preview: preview, message_count: count ?? 0, updated_at: new Date().toISOString() }).eq('id', conversationId);
    await supabaseAdmin.from('whatsapp_accounts').update({ last_message_at: normalized.sentAt, last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', accountId);
  }

  private mapMessageType(type: string): ProviderMessage['messageType'] {
    if (type === 'image' || type === 'sticker') return 'image';
    if (type === 'audio' || type === 'ptt') return 'audio';
    if (type === 'video') return 'video';
    if (type === 'document') return 'document';
    return 'text';
  }

  private previewFor(type: ProviderMessage['messageType']) {
    return ({ image: '[Imagem]', audio: '[Áudio]', video: '[Vídeo]', document: '[Documento]', text: '' })[type];
  }

  private extensionFor(mimeType: string, fileName?: string | null) {
    const fromName = fileName?.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (fromName) return fromName.slice(0, 10);
    const subtype = mimeType.split('/')[1]?.split(';')[0]?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return subtype || 'bin';
  }

  private async updateStatus(accountId: string, status: WhatsAppStatus) {
    await supabaseAdmin.from('whatsapp_accounts').update({ status, connected: status === 'connected', updated_at: new Date().toISOString() }).eq('id', accountId);
    await this.upsertSessionRow(accountId, status, status === 'connected');
  }

  private async upsertSessionRow(accountId: string, status: WhatsAppStatus, connected: boolean) {
    await supabaseAdmin.from('whatsapp_sessions').upsert({
      whatsapp_account_id: accountId,
      session_identifier: accountId,
      status,
      connected_at: connected ? new Date().toISOString() : null,
      disconnected_at: status === 'disconnected' ? new Date().toISOString() : null,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'whatsapp_account_id' });
  }
}
