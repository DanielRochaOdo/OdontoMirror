import { ArrowLeft, Info, LockKeyhole, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConversationList } from '../components/conversations/ConversationList';
import { MessageBubble } from '../components/messages/MessageContent';
import { WhatsAppStatusBadge } from '../components/whatsapp/WhatsAppStatusBadge';
import { Button } from '../components/ui/button';
import { useConversation, useConversations, useMessages, useWhatsAppAccount } from '../hooks/queries';
import { whatsappApi } from '../lib/api';
import { logAuditEvent } from '../lib/audit';
import { useAppStore } from '../stores/app-store';

export function ConversationsPage() {
  const { accountId, conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const storeConversation = useAppStore((state) => state.selectConversation);
  const { data: account, isLoading: loadingAccount } = useWhatsAppAccount(accountId);
  const { data: conversationItems = [], isLoading: loadingConversations } = useConversations(accountId, search);
  const activeId = conversationId ?? conversationItems[0]?.id;
  const { data: conversation } = useConversation(accountId, activeId);
  const { data: messageItems = [], isLoading: loadingMessages } = useMessages(accountId, activeId);
  useEffect(() => { if (activeId) storeConversation(activeId); }, [activeId, storeConversation]);
  useEffect(() => { if (accountId && activeId) void logAuditEvent('VIEW_CONVERSATION', 'conversation', activeId, accountId, { entity_label: conversation?.contact.name ?? 'Conversa' }); }, [accountId, activeId, conversation?.contact.name]);
  const selectedConversation = useMemo(() => conversation ?? conversationItems.find((item) => item.id === activeId), [conversation, conversationItems, activeId]);

  if (loadingAccount) return <div className="page-stack"><div className="skeleton-row" /></div>;
  if (!account) return <div className="page-stack"><Link className="back-link" to="/whatsapps"><ArrowLeft size={16} /> Voltar para WhatsApps</Link><div className="empty-state"><Info size={24} /><strong>Número não encontrado</strong><span>Selecione um número corporativo válido.</span></div></div>;
  const selectConversation = (id: string) => navigate(`/whatsapps/${account.id}/conversations/${id}`);
  const sync = async () => {
    try { await whatsappApi.sync(account.id); toast.success('Sincronização iniciada.'); setTimeout(() => { void queryClient.invalidateQueries({ queryKey: ['conversations', account.id] }); }, 1_500); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar.'); }
  };

  return <div className="conversation-page"><div className="conversation-top"><Link className="back-link" to="/whatsapps"><ArrowLeft size={16} /> Todos os números</Link><div className="account-context"><div className={`account-avatar avatar-${account.id}`}><span>{account.name.slice(0, 2).toUpperCase()}</span></div><div><h1>{account.name}</h1><span>{account.phoneNumber}</span></div><WhatsAppStatusBadge status={account.status} /></div><div className="context-actions"><Button variant="outline" size="sm" disabled={!account.connected} onClick={() => void sync()}><RefreshCw size={15} /> Sincronizar</Button></div></div><div className="conversation-workspace"><ConversationList conversations={conversationItems} selectedId={activeId} search={search} setSearch={setSearch} onSelect={selectConversation} /><main className="message-panel">{selectedConversation ? <><div className="message-panel-head"><div className="contact-avatar contact-avatar-large">{selectedConversation.contact.name.slice(0, 2).toUpperCase()}<i /></div><div><h2>{selectedConversation.contact.name}</h2><span>{selectedConversation.contact.phone || selectedConversation.conversationType} · {selectedConversation.messageCount} mensagens sincronizadas</span></div></div><div className="message-list">{loadingMessages ? <div className="message-loading" /> : messageItems.length ? messageItems.map((message) => <MessageBubble message={message} key={message.id} />) : <div className="message-empty"><div className="message-empty-icon"><Search size={22} /></div><strong>Nenhuma mensagem sincronizada</strong><span>Use “Sincronizar” para importar o histórico disponível desta conversa.</span></div>}</div><div className="readonly-banner"><div className="readonly-banner-icon"><LockKeyhole size={16} /></div><div><strong>Modo de conferência · somente leitura</strong><span>Nenhuma mensagem pode ser enviada por esta plataforma.</span></div><ShieldCheck size={16} /></div></> : <div className="message-empty"><div className="message-empty-icon"><Search size={22} /></div><strong>{loadingConversations ? 'Carregando conversas...' : 'Selecione uma conversa'}</strong><span>Escolha uma conversa na lista para consultar o histórico.</span></div>}</main></div></div>;
}
