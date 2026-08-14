import { AlertTriangle, ArrowUpRight, MessageCircleMore, Search, Smartphone, UserRound, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCommercialLeads, useCommercialVendors, useWhatsAppAccounts } from '../hooks/queries';
import { useWhatsAppVendorAssignments } from '../hooks/vendorOwnership';

export function VendorsPage() {
  const { data: vendors = [], isLoading: loadingVendors } = useCommercialVendors();
  const { data: accounts = [], isLoading: loadingAccounts } = useWhatsAppAccounts();
  const { data: assignments = [], isLoading: loadingAssignments } = useWhatsAppVendorAssignments();
  const { data: leads = [], isLoading: loadingLeads } = useCommercialLeads();
  const [search, setSearch] = useState('');

  const accountsByVendor = useMemo(() => {
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const result = new Map<string, typeof accounts>();
    for (const assignment of assignments) {
      const account = accountById.get(assignment.whatsappAccountId);
      if (!account) continue;
      const list = result.get(assignment.vendorId) ?? [];
      list.push(account);
      result.set(assignment.vendorId, list);
    }
    return result;
  }, [accounts, assignments]);

  const leadsByVendor = useMemo(() => {
    const result = new Map<string, typeof leads>();
    for (const lead of leads) {
      for (const assignment of lead.assignments) {
        const list = result.get(assignment.vendor.id) ?? [];
        list.push(lead);
        result.set(assignment.vendor.id, list);
      }
    }
    return result;
  }, [leads]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return vendors.filter((vendor) => vendor.active && (!needle || `${vendor.name} ${vendor.email ?? ''}`.toLowerCase().includes(needle)));
  }, [search, vendors]);

  const loading = loadingVendors || loadingAccounts || loadingAssignments || loadingLeads;
  const linkedVendorCount = visible.filter((vendor) => (accountsByVendor.get(vendor.id)?.length ?? 0) > 0).length;
  const totalNoFollowup = visible.reduce((total, vendor) => total + (leadsByVendor.get(vendor.id) ?? []).filter((lead) => lead.metrics.noFollowup).length, 0);

  return <div className="page-stack">
    <div className="page-heading">
      <div>
        <p className="eyebrow">GESTÃO COMERCIAL</p>
        <h1>Vendedores</h1>
        <p className="page-subtitle">Acompanhe quem utiliza cada WhatsApp corporativo e como está o pós-venda da carteira.</p>
      </div>
    </div>

    <div className="overview-grid">
      <div className="overview-card"><div className="overview-icon blue"><UsersRound size={18} /></div><div><span>Vendedores ativos</span><strong>{visible.length.toString().padStart(2, '0')}</strong></div><small>sincronizados do Rotas</small></div>
      <div className="overview-card"><div className="overview-icon violet"><Smartphone size={18} /></div><div><span>Com WhatsApp vinculado</span><strong>{linkedVendorCount.toString().padStart(2, '0')}</strong></div><small>responsáveis identificados</small></div>
      <div className="overview-card"><div className="overview-icon orange"><AlertTriangle size={18} /></div><div><span>Leads sem follow-up</span><strong>{totalNoFollowup.toString().padStart(2, '0')}</strong></div><small>na carteira atual</small></div>
    </div>

    <section className="content-panel">
      <div className="panel-toolbar">
        <div><h2>Equipe comercial</h2><p>Selecione um vendedor para abrir sua visão administrativa</p></div>
        <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar vendedor ou e-mail..." /></label>
      </div>

      {loading ? <div className="loading-list">{[1, 2, 3].map((item) => <div className="skeleton-row" key={item} />)}</div> : <div className="vendor-admin-grid">
        {visible.map((vendor) => {
          const vendorAccounts = accountsByVendor.get(vendor.id) ?? [];
          const vendorLeads = leadsByVendor.get(vendor.id) ?? [];
          const conversationCount = vendorAccounts.reduce((total, account) => total + account.conversationCount, 0);
          const noFollowup = vendorLeads.filter((lead) => lead.metrics.noFollowup).length;
          const connected = vendorAccounts.filter((account) => account.connected).length;
          return <Link to={`/vendors/${vendor.id}`} className="vendor-admin-card" key={vendor.id}>
            <div className="vendor-admin-head"><div className="avatar avatar-indigo">{vendor.name.slice(0, 2).toUpperCase()}</div><div><strong>{vendor.name}</strong><span>{vendor.email ?? 'E-mail não informado'}</span></div><ArrowUpRight size={18} /></div>
            <div className="vendor-admin-stats">
              <div><Smartphone size={15} /><strong>{vendorAccounts.length}</strong><span>WhatsApp{vendorAccounts.length === 1 ? '' : 's'}</span></div>
              <div><MessageCircleMore size={15} /><strong>{conversationCount}</strong><span>conversas</span></div>
              <div><UserRound size={15} /><strong>{vendorLeads.length}</strong><span>leads</span></div>
              <div className={noFollowup ? 'warning-stat' : ''}><AlertTriangle size={15} /><strong>{noFollowup}</strong><span>sem follow-up</span></div>
            </div>
            <div className="vendor-admin-foot"><span className={vendorAccounts.length ? 'owner-linked' : 'owner-unlinked'}>{vendorAccounts.length ? `${connected}/${vendorAccounts.length} número(s) conectado(s)` : 'Nenhum WhatsApp vinculado'}</span></div>
          </Link>;
        })}
        {!visible.length && <div className="empty-state"><UsersRound size={24} /><strong>Nenhum vendedor encontrado</strong><span>Tente outro nome ou aguarde a próxima sincronização com o Rotas.</span></div>}
      </div>}
    </section>
  </div>;
}
