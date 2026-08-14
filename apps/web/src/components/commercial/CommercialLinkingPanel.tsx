import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useCommercialCompanies } from '../../hooks/queries';
import { commercialApi } from '../../lib/api';
import { supabase } from '../../lib/supabase';

type UnmatchedContact = {
  contact_id: string;
  whatsapp_account_id: string;
  account_name: string;
  contact_name: string;
  phone: string;
  phone_normalized: string;
  last_message_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'Sem mensagem registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function CommercialLinkingPanel() {
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCommercialCompanies();
  const [search, setSearch] = useState('');
  const [selectedCompanyByContact, setSelectedCompanyByContact] = useState<Record<string, string>>({});
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const { data: contacts = [], isFetching, refetch } = useQuery({
    queryKey: ['commercial-unmatched-contacts', search],
    queryFn: async (): Promise<UnmatchedContact[]> => {
      const { data, error } = await supabase.rpc('admin_list_unmatched_commercial_contacts', {
        p_search: search.trim() || null,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as UnmatchedContact[];
    },
    staleTime: 10_000,
  });

  const linkContact = async (contact: UnmatchedContact) => {
    const companyId = selectedCompanyByContact[contact.contact_id];
    if (!companyId) return toast.error('Selecione a empresa antes de vincular.');
    setLinkingId(contact.contact_id);
    try {
      const { error } = await supabase.rpc('admin_link_commercial_contact', {
        p_contact_id: contact.contact_id,
        p_company_id: companyId,
        p_department: null,
        p_display_name: null,
      });
      if (error) throw error;
      try { await commercialApi.sync(); } catch { /* scheduled sync will reconcile responsibility */ }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['commercial-leads'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-vendors'] }),
      ]);
      toast.success('Contato vinculado à empresa. Os responsáveis seguem o direcionamento do Rotas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o contato.');
    } finally { setLinkingId(null); }
  };

  return <div className="commercial-linking-panel">
    <div className="linking-toolbar"><label className="kanban-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contato ou telefone sem vínculo" /></label><span>{isFetching ? 'Atualizando...' : `${contacts.length} contato(s) exibido(s)`}</span></div>
    <div className="unmatched-contact-list">
      {contacts.map((contact) => <div className="unmatched-contact-row" key={contact.contact_id}>
        <div className="unmatched-contact-main"><div className="avatar avatar-small avatar-indigo">{contact.contact_name.slice(0, 2).toUpperCase()}</div><div><strong>{contact.contact_name || contact.phone}</strong><span>{contact.phone} · {contact.account_name}</span><small>Última mensagem: {formatDate(contact.last_message_at)}</small></div></div>
        <select value={selectedCompanyByContact[contact.contact_id] ?? ''} onChange={(event) => setSelectedCompanyByContact((current) => ({ ...current, [contact.contact_id]: event.target.value }))}><option value="">Selecionar empresa...</option>{companies.map((company) => <option value={company.id} key={company.id}>{company.companyCode ? `${company.companyCode} - ` : ''}{company.companyName}</option>)}</select>
        <Button size="sm" variant="secondary" disabled={linkingId === contact.contact_id || !selectedCompanyByContact[contact.contact_id]} onClick={() => void linkContact(contact)}><Link2 size={15} /> {linkingId === contact.contact_id ? 'Vinculando...' : 'Vincular'}</Button>
      </div>)}
      {!contacts.length && !isFetching && <p className="empty-copy">Nenhum contato pendente de vínculo foi encontrado.</p>}
    </div>
  </div>;
}
