import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Inbox, Link2, MessageCircleMore, Phone, RefreshCcw, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import type { CommercialLead } from '../../types';

type LeadConversation = {
  conversationId: string;
  whatsappAccountId: string;
  whatsappAccountName: string;
  vendorId?: string;
  vendorName?: string;
  contactId?: string;
  contactName: string;
  phone: string;
  phoneNormalized?: string;
  lastMessageAt?: string;
  messageCount: number;
  lastMessagePreview: string;
  isManual?: boolean;
};

type RpcConversationRow = {
  conversation_id: string;
  whatsapp_account_id: string;
  whatsapp_account_name: string;
  vendor_id: string | null;
  vendor_name: string | null;
  contact_id: string | null;
  contact_name: string;
  phone: string;
  phone_normalized: string | null;
  last_message_at: string | null;
  message_count: number;
  last_message_preview: string | null;
  is_manual?: boolean;
};

function mapConversation(row: RpcConversationRow): LeadConversation {
  return {
    conversationId: row.conversation_id,
    whatsappAccountId: row.whatsapp_account_id,
    whatsappAccountName: row.whatsapp_account_name,
    vendorId: row.vendor_id ?? undefined,
    vendorName: row.vendor_name ?? undefined,
    contactId: row.contact_id ?? undefined,
    contactName: row.contact_name,
    phone: row.phone,
    phoneNormalized: row.phone_normalized ?? undefined,
    lastMessageAt: row.last_message_at ?? undefined,
    messageCount: row.message_count,
    lastMessagePreview: row.last_message_preview ?? '',
    isManual: row.is_manual ?? false,
  };
}

function formatDateTime(value?: string) {
  if (!value) return 'Sem mensagens';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem mensagens';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function useLeadConversations(leadId: string) {
  return useQuery({
    queryKey: ['commercial-lead-conversations', leadId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_commercial_lead_conversations', {
        p_lead_id: leadId,
      });
      if (error) throw error;
      return ((data ?? []) as RpcConversationRow[]).map(mapConversation);
    },
  });
}

function useLeadContactCandidates(leadId: string, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['commercial-lead-contact-candidates', leadId, search],
    enabled,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_commercial_lead_contact_candidates', {
        p_lead_id: leadId,
        p_search: search.trim() || null,
        p_limit: 100,
      });
      if (error) throw error;
      return ((data ?? []) as RpcConversationRow[]).map(mapConversation);
    },
  });
}

export function AdminLeadContactSection({ lead, onChanged }: {
  lead: CommercialLead;
  onChanged: () => Promise<void> | void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [savingConversationId, setSavingConversationId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const conversationsQuery = useLeadConversations(lead.id);
  const candidatesQuery = useLeadContactCandidates(lead.id, search, pickerOpen);
  const conversations = conversationsQuery.data ?? [];
  const candidates = candidatesQuery.data ?? [];
  const hasResponsibleVendor = lead.assignments.length > 0;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['commercial-leads'] }),
      queryClient.invalidateQueries({ queryKey: ['commercial-lead-conversations', lead.id] }),
      queryClient.invalidateQueries({ queryKey: ['commercial-lead-contact-candidates', lead.id] }),
    ]);
    await onChanged();
  };

  const selectConversation = async (conversation: LeadConversation) => {
    setSavingConversationId(conversation.conversationId);
    try {
      const { error } = await supabase.rpc('admin_set_commercial_lead_contact_override', {
        p_lead_id: lead.id,
        p_conversation_id: conversation.conversationId,
      });
      if (error) throw error;
      await refresh();
      setPickerOpen(false);
      setSearch('');
      toast.success(`${conversation.contactName} foi vinculado ao card.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o contato.');
    } finally {
      setSavingConversationId(null);
    }
  };

  const restoreAutomatic = async () => {
    setRestoring(true);
    try {
      const { error } = await supabase.rpc('admin_restore_commercial_lead_automatic_contact', {
        p_lead_id: lead.id,
      });
      if (error) throw error;
      await refresh();
      setPickerOpen(false);
      setSearch('');
      toast.success('Contato automático do Rotas restaurado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível restaurar o contato do Rotas.');
    } finally {
      setRestoring(false);
    }
  };

  const openConversation = (conversation: LeadConversation) => {
    navigate(`/whatsapps/${conversation.whatsappAccountId}/conversations/${conversation.conversationId}`);
  };

  return <section className="lead-detail-section lead-detail-full lead-contact-admin-section">
    <div className="section-title-row">
      <MessageCircleMore size={17} />
      <div>
        <h3>Contato / WhatsApp</h3>
        <p>O contato manual só pode ser escolhido entre as caixas de entrada vinculadas aos vendedores responsáveis por este card.</p>
      </div>
    </div>

    <div className="lead-contact-summary">
      <div className="lead-contact-main">
        <span className={`lead-contact-source ${lead.linkSource === 'manual' ? 'manual' : 'automatic'}`}>
          {lead.linkSource === 'manual' ? 'Manual · Administrador' : 'Automático · Rotas'}
        </span>
        <strong>{lead.contactName ?? lead.company.contactName ?? 'Contato não informado'}</strong>
        <span><Phone size={13} /> {lead.contactPhone ?? lead.linkedPhoneNormalized ?? 'Telefone não informado'}</span>
      </div>
      <div className="lead-contact-actions">
        <Button
          size="sm"
          variant="secondary"
          disabled={!hasResponsibleVendor}
          onClick={() => setPickerOpen((current) => !current)}
        >
          <Link2 size={14} /> {conversations.length ? 'Alterar contato' : 'Selecionar contato da caixa de entrada'}
        </Button>
        {lead.linkSource === 'manual' && <Button size="sm" variant="outline" disabled={restoring} onClick={() => void restoreAutomatic()}>
          <RefreshCcw size={14} /> {restoring ? 'Restaurando...' : 'Restaurar contato do Rotas'}
        </Button>}
      </div>
    </div>

    {!hasResponsibleVendor && <div className="lead-contact-empty">
      <UserRound size={16} /> Nenhum vendedor responsável está disponível para limitar a caixa de entrada deste card.
    </div>}

    {conversationsQuery.isLoading ? <div className="lead-contact-empty">Localizando conversa correspondente...</div> : conversations.length ? <div className="lead-conversation-list">
      {conversations.map((conversation) => <div className="lead-conversation-row" key={conversation.conversationId}>
        <div className="lead-conversation-icon"><Inbox size={16} /></div>
        <div className="lead-conversation-copy">
          <div><strong>{conversation.contactName}</strong>{conversation.isManual && <span className="lead-contact-mini-badge">Selecionada</span>}</div>
          <span>{conversation.phone} · {conversation.whatsappAccountName}{conversation.vendorName ? ` · ${conversation.vendorName}` : ''}</span>
          <small>{conversation.messageCount} mensagens · {formatDateTime(conversation.lastMessageAt)}</small>
        </div>
        <Button size="sm" variant="outline" onClick={() => openConversation(conversation)}>Ver conversa</Button>
      </div>)}
    </div> : <div className="lead-contact-empty">
      <MessageCircleMore size={16} /> Nenhuma conversa correspondente foi localizada para o telefone atual deste card.
    </div>}

    {pickerOpen && <div className="lead-contact-picker">
      <div className="lead-contact-picker-head">
        <div><strong>Selecionar contato da caixa de entrada</strong><span>Somente conversas dos WhatsApps vinculados aos responsáveis atuais.</span></div>
        <label className="lead-contact-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou mensagem" autoFocus /></label>
      </div>

      <div className="lead-contact-candidates">
        {candidatesQuery.isLoading && <div className="lead-contact-empty">Carregando caixa de entrada...</div>}
        {!candidatesQuery.isLoading && candidates.map((candidate) => <div className="lead-contact-candidate" key={`${candidate.whatsappAccountId}:${candidate.conversationId}`}>
          <div className="lead-conversation-icon"><UserRound size={16} /></div>
          <div className="lead-conversation-copy">
            <strong>{candidate.contactName}</strong>
            <span>{candidate.phone} · {candidate.whatsappAccountName}{candidate.vendorName ? ` · ${candidate.vendorName}` : ''}</span>
            <small>{candidate.lastMessagePreview || `${candidate.messageCount} mensagens`} · {formatDateTime(candidate.lastMessageAt)}</small>
          </div>
          <Button
            size="sm"
            disabled={savingConversationId === candidate.conversationId}
            onClick={() => void selectConversation(candidate)}
          >
            {savingConversationId === candidate.conversationId ? 'Vinculando...' : 'Usar este contato'}
          </Button>
        </div>)}
        {!candidatesQuery.isLoading && !candidates.length && <div className="lead-contact-empty">Nenhuma conversa disponível nessa caixa de entrada para a busca informada.</div>}
      </div>
    </div>}
  </section>;
}
