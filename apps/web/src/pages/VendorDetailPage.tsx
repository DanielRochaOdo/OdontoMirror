import { AlertTriangle, ArrowLeft, Columns3, MessageCircleMore, Smartphone, UserRound, Wifi, WifiOff } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useCommercialLeads, useCommercialVendors, useWhatsAppAccounts } from '../hooks/queries';
import { useRecentVendorConversations, useWhatsAppVendorAssignments } from '../hooks/vendorOwnership';
import { formatRelativeDate } from '../lib/utils';

export function VendorDetailPage() {
  const { vendorId } = useParams();
  const { data: vendors = [] } = useCommercialVendors();
  const { data: accounts = [] } = useWhatsAppAccounts();
  const { data: assignments = [] } = useWhatsAppVendorAssignments();
  const { data: leads = [] } = useCommercialLeads();

  const vendor = vendors.find((item) => item.id === vendorId);
  const accountIds = assignments.filter((item) => item.vendorId === vendorId).map((item) => item.whatsappAccountId);
  const vendorAccounts = accounts.filter((account) => accountIds.includes(account.id));
  const vendorLeads = leads.filter((lead) => lead.assignments.some((assignment) => assignment.vendor.id === vendorId));
  const { data: recentConversations = [] } = useRecentVendorConversations(accountIds);

  if (!vendor) return <div className="page-stack"><div className="empty-state"><UserRound size={24} /><strong>Vendedor não encontrado</strong><span>Este vendedor pode ter sido desativado ou ainda não sincronizado.</span><Link className="link-button" to="/vendors">Voltar para vendedores</Link></div></div>;

  const noFollowup = vendorLeads.filter((lead) => lead.metrics.noFollowup).length;
  const hotLeads = vendorLeads.filter((lead) => lead.metrics.temperature === 'hot').length;
  const conversationCount = vendorAccounts.reduce((total, account) => total + account.conversationCount, 0);

  return <div className="page-stack">
    <div className="page-heading vendor-detail-heading">
      <div>
        <Link className="back-link" to="/vendors"><ArrowLeft size={15} /> Vendedores</Link>
        <p className="eyebrow">VISÃO ADMINISTRATIVA</p>
        <h1>{vendor.name}</h1>
        <p className="page-subtitle">{vendor.email ?? 'E-mail não informado'} · dados de acesso sincronizados do Rotas</p>
      </div>
      <div className="vendor-detail-actions"><Link className="button-link" to={`/kanban?vendor=${vendor.id}`}><Columns3 size={16} /> Ver Kanban</Link></div>
    </div>

    <div className="overview-grid">
      <div className="overview-card"><div className="overview-icon violet"><Smartphone size={18} /></div><div><span>WhatsApps vinculados</span><strong>{vendorAccounts.length.toString().padStart(2, '0')}</strong></div><small>{vendorAccounts.filter((account) => account.connected).length} conectado(s)</small></div>
      <div className="overview-card"><div className="overview-icon blue"><MessageCircleMore size={18} /></div><div><span>Conversas</span><strong>{conversationCount}</strong></div><small>nos números vinculados</small></div>
      <div className="overview-card"><div className="overview-icon green"><UserRound size={18} /></div><div><span>Leads atuais</span><strong>{vendorLeads.length}</strong></div><small>{hotLeads} quente(s)</small></div>
      <div className="overview-card"><div className="overview-icon orange"><AlertTriangle size={18} /></div><div><span>Sem follow-up</span><strong>{noFollowup}</strong></div><small>exigem atenção</small></div>
    </div>

    <div className="vendor-detail-columns">
      <section className="content-panel">
        <div className="panel-toolbar"><div><h2>WhatsApps do vendedor</h2><p>Números corporativos atribuídos administrativamente</p></div></div>
        <div className="vendor-account-list">
          {vendorAccounts.map((account) => <Link to={`/whatsapps/${account.id}/conversations`} className="vendor-account-card" key={account.id}>
            <div className={`account-avatar avatar-${account.id}`}><span>{account.name.slice(0, 2).toUpperCase()}</span><i className={account.connected ? 'online' : ''} /></div>
            <div><strong>{account.name}</strong><span>{account.phoneNumber}</span><small>{account.lastMessageAt ? `Última atividade ${formatRelativeDate(account.lastMessageAt)}` : 'Sem mensagens'}</small></div>
            <div className={`vendor-account-status ${account.connected ? 'connected' : 'disconnected'}`}>{account.connected ? <Wifi size={14} /> : <WifiOff size={14} />}{account.connected ? 'Conectado' : 'Desconectado'}</div>
          </Link>)}
          {!vendorAccounts.length && <div className="empty-state compact-empty"><Smartphone size={22} /><strong>Nenhum WhatsApp vinculado</strong><span>Faça o vínculo na tela de WhatsApps corporativos.</span><Link className="link-button" to="/whatsapps">Ir para WhatsApps</Link></div>}
        </div>
      </section>

      <section className="content-panel">
        <div className="panel-toolbar"><div><h2>Conversas recentes</h2><p>Últimas conversas dos números vinculados</p></div></div>
        <div className="vendor-conversation-list">
          {recentConversations.map((conversation) => <Link to={`/whatsapps/${conversation.whatsappAccountId}/conversations/${conversation.id}`} className="vendor-conversation-row" key={conversation.id}>
            <div className="avatar avatar-small avatar-indigo">{conversation.contactName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{conversation.contactName}</strong><span>{conversation.contactPhone || 'Telefone não informado'}</span><p>{conversation.lastMessagePreview || 'Sem prévia da última mensagem'}</p></div>
            <div><strong>{conversation.messageCount}</strong><span>mensagens</span><small>{conversation.lastMessageAt ? formatRelativeDate(conversation.lastMessageAt) : '—'}</small></div>
          </Link>)}
          {!recentConversations.length && <div className="empty-state compact-empty"><MessageCircleMore size={22} /><strong>Nenhuma conversa disponível</strong><span>Sincronize o WhatsApp vinculado para carregar as conversas.</span></div>}
        </div>
      </section>
    </div>
  </div>;
}
