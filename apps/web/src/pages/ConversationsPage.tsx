import { ArrowLeft, Info, LockKeyhole, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConversationList } from '../components/conversations/ConversationList';
import { MessageBubble } from '../components/messages/MessageContent';
import { SyncProgressBanner } from '../components/whatsapp/SyncProgressBanner';
import { WhatsAppStatusBadge } from '../components/whatsapp/WhatsAppStatusBadge';
import { Button } from '../components/ui/button';
import { useConversation, useConversations, useMessages, useWhatsAppAccount } from '../hooks/queries';
import { whatsappApi, type SyncProgress } from '../lib/api';
import { logAuditEvent } from '../lib/audit';
import { useAppStore } from '../stores/app-store';

export function ConversationsPage() {
  const { accountId, conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [syncVisible, setSyncVisible] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const storeConversation = useAppStore((state) => state.selectConversation);
  const { data: account, isLoading: loadingAccount } = useWhatsAppAccount(accountId);
  const { data: conversationItems = [], isLoading: loadingConversations } = useConversations(accountId, search);
  const activeId = conversationId ?? conversationItems[0]?.id;
  const { data: conversation } = useConversation(accountId, activeId);
  const { data: messageItems = [], isLoading: loadingMessages } = useMessages(accountId, activeId);

  useEffect(() => { if (activeId) storeConversation(activeId); }, [activeId, storeConversation]);
  useEffect(() => { if (accountId && activeId) void logAuditEvent('VIEW_CONVERSATION', 'conversation', activeId, accountId, { entity_label: conversation?.contact.name ?? 'Conversa' }); }, [accountId, activeId, conversation?.contact.name]);
  useEffect(() => {
    if (loadingMessages || !messageItems.length) return;
    const messageList = document.querySelector<HTMLElement>('.message-list');
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [activeId, loadingMessages, messageItems]);

  const selectedConversation = useMemo(() => conversation ?? conversationItems.find((item) => item.id === activeId), [conversation, conversationItems, activeId]);

  if (loadingAccount) return <div className="page-stack"><div className="skeleton-row" /></div>;
  if (!account) return <div className="page-stack"><Link className="back-link" to="/whatsapps"><ArrowLeft size={16} /> Voltar para WhatsApps</Link><div className="empty-state"><Info size={24} /><strong>Número não encontrado</strong><span>Selecione um número corporativo válido.</span></div></div>;

  const selectConversation = (id: string) => navigate(`/whatsapps/${account.id}/conversations/${id}`);

  const sync = async () => {
    setSyncPending(true);
    try {
      const current = await whatsappApi.status(account.id);
      if (current.status !== 'connected') throw new Error('Este WhatsApp não está conectado no backend. Reconecte o número antes de sincronizar.');
      await whatsappApi.sync(account.id);
      setSyncVisible(true);
      toast.success('Sincronização iniciada. Acompanhe o andamento abaixo.');
    } catch (error) {
      setSyncVisible(false);
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar.');
    } finally {
      setSyncPending(false);
    }
  };

  const syncFinished = (progress: SyncProgress) => {
    if (progress.status === 'completed') {
      toast.success('Sincronização concluída.');
      void queryClient.invalidateQueries({ queryKey: ['conversations', account.id] });
      void queryClient.invalidateQueries({ queryKey: ['messages', account.id] });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
    } else if (progress.status === 'failed') {
      toast.error(progress.error ?? 'A sincronização foi encerrada com erro.');
    }
  };

  return <div className="conversation-page"><div className="conversation-top"><Link className="back-link" to="/whatsapps"><ArrowLeft size={16} /> Todos os números</Link><div className="account-context"><div className={`account-avatar avatar-${account.id}`}><span>{account.name.slice(0, 2).toUpperCase()}</span></div><div><h1>{account.name}</h1><span>{account.phoneNumber}</span></div><WhatsAppStatusBadge status={account.status} /></div><div className="context-actions"><Button variant="outline" size="sm" disabled={!account.connected || syncPending} onClick={() => void sync()}><RefreshCw className={syncPending ? 'spin' : undefined} size={15} /> {syncPending ? 'Iniciando...' : 'Sincronizar'}</Button></div></div>{syncVisible && <SyncProgressBanner accountId={account.id} accountName={account.name} onFinished={syncFinished} onClose={() => setSyncVisible(false)} />}<div className="conversation-workspace"><ConversationList conversations={conversationItems} selectedId={activeId} search={search} setSearch={setSearch} onSelect={selectConversation} /><main className="message-panel">{selectedConversation ? <><div className="message-panel-head"><div className="contact-avatar contact-avatar-large">{selectedConversation.contact.name.slice(0, 2).toUpperCase()}<i /></div><div><h2>{selectedConversation.contact.name}</h2><span>{selectedConversation.contact.phone || selectedConversation.conversationType} · {selectedConversation.messageCount} mensagens sincronizadas</span></div></div><div className="message-list">{loadingMessages ? <div className="message-loading" /> : messageItems.length ? messageItems.map((message) => <MessageBubble message={message} key={message.id} />) : <div className="message-empty"><div className="message-empty-icon"><Search size={22} /></div><strong>Nenhuma mensagem sincronizada</strong><span>Use “Sincronizar” para importar o histórico disponível desta conversa.</span></div>}</div><div className="readonly-banner"><div className="readonly-banner-icon"><LockKeyhole size={16} /></div><div><strong>Modo de conferência · somente leitura</strong><span>Nenhuma mensagem pode ser enviada por esta plataforma.</span></div><ShieldCheck size={16} /></div></> : <div className="message-empty"><div className="message-empty-icon"><Search size={22} /></div><strong>{loadingConversations ? 'Carregando conversas...' : 'Selecione uma conversa'}</strong><span>Escolha uma conversa na lista para consultar o histórico.</span></div>}</main></div></div>;
}
