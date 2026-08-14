import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Clock3,
  Flame,
  History,
  MessageCircleMore,
  Pencil,
  Search,
  StickyNote,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Dialog } from '../components/ui/dialog';
import {
  useCommercialCompanies,
  useCommercialLeadHistory,
  useCommercialLeadNotes,
  useCommercialLeads,
  useCommercialVendors,
  useKanbanStatuses,
  useProfile,
} from '../hooks/queries';
import {
  addCommercialLeadNote,
  moveCommercialLead,
  relinkCommercialLead,
  updateCommercialLeadIdentity,
} from '../lib/commercial';
import type { CommercialLead, KanbanStatus, LeadTemperature } from '../types';

const temperatureLabel: Record<LeadTemperature, string> = {
  hot: 'Quente',
  warm: 'Morno',
  cold: 'Frio',
  stopped: 'Parado',
  unknown: 'Sem leitura',
};

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function minutesLabel(minutes?: number) {
  if (minutes === undefined) return 'Sem follow-up';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function LeadCard({ lead, onOpen, onDragStart }: {
  lead: CommercialLead;
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const metrics = lead.metrics;
  return <article
    className={`kanban-card temperature-${metrics.temperature}`}
    draggable
    onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', lead.id); onDragStart(); }}
    onClick={onOpen}
  >
    <div className="kanban-card-head">
      <div>
        <strong>{lead.displayName}</strong>
        <span>{lead.company.companyCode ? `${lead.company.companyCode} · ` : ''}{lead.contactName ?? lead.company.contactName ?? 'Contato não informado'}</span>
      </div>
      <span className={`temperature-pill temperature-pill-${metrics.temperature}`}><Flame size={13} /> {temperatureLabel[metrics.temperature]}</span>
    </div>
    <div className="kanban-card-meta">
      {lead.department && <span><Building2 size={14} /> {lead.department}</span>}
      <span><CalendarDays size={14} /> Visita {formatDate(metrics.lastVisitAt ?? lead.company.lastVisitAt)}</span>
      <span><Clock3 size={14} /> {metrics.lastInteractionAt ? `Interação ${formatDateTime(metrics.lastInteractionAt)}` : 'Sem interação recente'}</span>
    </div>
    {metrics.noFollowup && <div className="lead-warning"><AlertTriangle size={14} /> Visitado sem follow-up após a última visita</div>}
    <div className="vendor-chip-row">
      {lead.assignments.length > 0 ? lead.assignments.map((assignment) => <span className="vendor-chip" key={assignment.id}><UserRound size={12} /> {assignment.vendor.name}</span>) : <span className="vendor-chip vendor-chip-muted">Sem responsável atual</span>}
    </div>
  </article>;
}

function LeadDetailDialog({ lead, statuses, isAdmin, onClose }: {
  lead: CommercialLead | null;
  statuses: KanbanStatus[];
  isAdmin: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: history = [] } = useCommercialLeadHistory(lead?.id);
  const { data: notes = [] } = useCommercialLeadNotes(lead?.id);
  const { data: companies = [] } = useCommercialCompanies();
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [note, setNote] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [saving, setSaving] = useState(false);

  const statusById = useMemo(() => new Map(statuses.map((status) => [status.id, status.name])), [statuses]);
  const activeLead = lead;
  if (!activeLead) return null;

  const effectiveName = displayName || activeLead.displayName;
  const effectiveDepartment = department || activeLead.department || '';
  const effectiveCompanyId = companyId || activeLead.company.id;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['commercial-leads'] }),
      queryClient.invalidateQueries({ queryKey: ['commercial-lead-history', activeLead.id] }),
      queryClient.invalidateQueries({ queryKey: ['commercial-lead-notes', activeLead.id] }),
    ]);
  };

  const saveIdentity = async () => {
    setSaving(true);
    try {
      await updateCommercialLeadIdentity(activeLead.id, effectiveName, effectiveDepartment);
      await refresh();
      setDisplayName(''); setDepartment('');
      toast.success('Identificação comercial atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o lead.');
    } finally { setSaving(false); }
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addCommercialLeadNote(activeLead.id, note.trim());
      setNote('');
      await refresh();
      toast.success('Observação adicionada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível adicionar a observação.');
    } finally { setSaving(false); }
  };

  const changeStatus = async (statusId: string) => {
    if (statusId === activeLead.statusId) return;
    setSaving(true);
    try {
      await moveCommercialLead(activeLead.id, statusId);
      await refresh();
      toast.success('Etapa do lead atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a etapa.');
    } finally { setSaving(false); }
  };

  const correctCompany = async () => {
    if (!isAdmin || effectiveCompanyId === activeLead.company.id) return;
    setSaving(true);
    try {
      await relinkCommercialLead(activeLead.id, effectiveCompanyId);
      await refresh();
      setCompanyId('');
      toast.success('Vínculo da empresa corrigido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível corrigir o vínculo.');
    } finally { setSaving(false); }
  };

  return <Dialog open={Boolean(lead)} onClose={onClose} title={activeLead.displayName} description={`${activeLead.company.companyCode ? `Código ${activeLead.company.companyCode} · ` : ''}${activeLead.contactName ?? 'Contato comercial'}`} width="860px">
    <div className="lead-detail-grid">
      <section className="lead-detail-section">
        <div className="section-title-row"><Pencil size={17} /><div><h3>Identificação comercial</h3><p>Esses dados pertencem ao Mirror e não alteram o cadastro no Rotas.</p></div></div>
        <div className="compact-form-grid">
          <label>Nome no Kanban<input value={effectiveName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label>Setor / área<input placeholder="Ex.: RH" value={effectiveDepartment} onChange={(event) => setDepartment(event.target.value)} /></label>
        </div>
        <div className="inline-actions"><Button size="sm" disabled={saving || effectiveName.trim().length < 2} onClick={() => void saveIdentity()}>Salvar identificação</Button></div>
      </section>

      <section className="lead-detail-section">
        <div className="section-title-row"><ArrowRight size={17} /><div><h3>Etapa atual</h3><p>Movimente a jornada sem alterar o responsável definido pelo Rotas.</p></div></div>
        <select className="full-select" value={activeLead.statusId} disabled={saving} onChange={(event) => void changeStatus(event.target.value)}>
          {statuses.map((status) => <option value={status.id} key={status.id}>{status.name}</option>)}
        </select>
      </section>

      <section className="lead-detail-section lead-detail-full">
        <div className="section-title-row"><UsersRound size={17} /><div><h3>Responsáveis atuais</h3><p>Sincronizados automaticamente pelas visitas direcionadas no Rotas.</p></div></div>
        <div className="vendor-detail-list">
          {activeLead.assignments.length ? activeLead.assignments.map((assignment) => <div className="vendor-detail" key={assignment.id}><div className="avatar avatar-small avatar-indigo">{assignment.vendor.name.slice(0, 2).toUpperCase()}</div><div><strong>{assignment.vendor.name}</strong><span>{assignment.vendor.email ?? 'E-mail não informado'} · origem {assignment.source === 'route' ? 'Rotas' : 'manual'}{assignment.sourceVisitDate ? ` · ${formatDate(assignment.sourceVisitDate)}` : ''}</span></div></div>) : <p className="empty-copy">Nenhum vendedor está direcionado atualmente para esta empresa.</p>}
        </div>
      </section>

      <section className="lead-detail-section">
        <div className="section-title-row"><MessageCircleMore size={17} /><div><h3>Indicadores de acompanhamento</h3><p>Somente métricas; o vendedor não recebe o conteúdo do WhatsApp.</p></div></div>
        <div className="metric-grid">
          <div><span>Última visita</span><strong>{formatDateTime(activeLead.metrics.lastVisitAt)}</strong></div>
          <div><span>Última interação</span><strong>{formatDateTime(activeLead.metrics.lastInteractionAt)}</strong></div>
          <div><span>Visita → follow-up</span><strong>{minutesLabel(activeLead.metrics.followupDelayMinutes)}</strong></div>
          <div><span>Interações após visita</span><strong>{activeLead.metrics.interactionCountAfterVisit}</strong></div>
          <div><span>Recebidas</span><strong>{activeLead.metrics.inboundCountAfterVisit}</strong></div>
          <div><span>Enviadas</span><strong>{activeLead.metrics.outboundCountAfterVisit}</strong></div>
          <div><span>Dias sem interação</span><strong>{activeLead.metrics.daysWithoutInteraction ?? '—'}</strong></div>
          <div><span>Temperatura</span><strong>{temperatureLabel[activeLead.metrics.temperature]}</strong></div>
        </div>
      </section>

      <section className="lead-detail-section">
        <div className="section-title-row"><StickyNote size={17} /><div><h3>Observações comerciais</h3><p>Notas visíveis aos responsáveis atuais e ao administrador.</p></div></div>
        <textarea rows={3} placeholder="Registrar contexto, próximo passo ou combinação com o cliente..." value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="inline-actions"><Button size="sm" disabled={saving || !note.trim()} onClick={() => void saveNote()}>Adicionar observação</Button></div>
        <div className="timeline-list compact-timeline">
          {notes.map((item) => <div key={item.id}><span className="timeline-dot" /><div><strong>{item.authorName ?? 'Usuário'}</strong><p>{item.note}</p><small>{formatDateTime(item.createdAt)}</small></div></div>)}
          {!notes.length && <p className="empty-copy">Nenhuma observação registrada.</p>}
        </div>
      </section>

      <section className="lead-detail-section lead-detail-full">
        <div className="section-title-row"><History size={17} /><div><h3>Histórico da jornada</h3><p>Cada mudança de etapa mantém autor e horário.</p></div></div>
        <div className="timeline-list">
          {history.map((item) => <div key={item.id}><span className="timeline-dot" /><div><strong>{item.changedByName ?? 'Usuário'} movimentou o lead</strong><p>{item.fromStatusId ? statusById.get(item.fromStatusId) ?? 'Etapa anterior' : 'Início'} <ArrowRight size={12} /> {statusById.get(item.toStatusId) ?? 'Etapa'}</p><small>{formatDateTime(item.createdAt)}</small></div></div>)}
          {!history.length && <p className="empty-copy">O lead ainda não teve mudança manual de etapa.</p>}
        </div>
      </section>

      {isAdmin && <section className="lead-detail-section lead-detail-full admin-correction-box">
        <div className="section-title-row"><Building2 size={17} /><div><h3>Correção administrativa do vínculo</h3><p>Use somente quando a correspondência automática do telefone precisar ser corrigida.</p></div></div>
        <div className="correction-row"><select value={effectiveCompanyId} onChange={(event) => setCompanyId(event.target.value)}>{companies.map((company) => <option value={company.id} key={company.id}>{company.companyCode ? `${company.companyCode} - ` : ''}{company.companyName}</option>)}</select><Button variant="secondary" disabled={saving || effectiveCompanyId === activeLead.company.id} onClick={() => void correctCompany()}>Corrigir empresa</Button></div>
      </section>}
    </div>
  </Dialog>;
}

export function KanbanPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: statuses = [], isLoading: loadingStatuses } = useKanbanStatuses();
  const { data: leads = [], isLoading: loadingLeads } = useCommercialLeads();
  const { data: vendors = [] } = useCommercialVendors();
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [temperatureFilter, setTemperatureFilter] = useState<'all' | LeadTemperature>('all');
  const [onlyNoFollowup, setOnlyNoFollowup] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  const visibleLeads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (needle && !`${lead.displayName} ${lead.company.companyCode ?? ''} ${lead.company.companyName} ${lead.contactName ?? ''} ${lead.department ?? ''} ${lead.contactPhone ?? ''}`.toLowerCase().includes(needle)) return false;
      if (vendorFilter !== 'all' && !lead.assignments.some((assignment) => assignment.vendor.id === vendorFilter)) return false;
      if (temperatureFilter !== 'all' && lead.metrics.temperature !== temperatureFilter) return false;
      if (onlyNoFollowup && !lead.metrics.noFollowup) return false;
      return true;
    });
  }, [leads, onlyNoFollowup, search, temperatureFilter, vendorFilter]);

  const moveLead = async (leadId: string, statusId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.statusId === statusId || moving) return;
    setMoving(true);
    try {
      await moveCommercialLead(leadId, statusId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['commercial-leads'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-lead-history', leadId] }),
      ]);
      toast.success(`${lead.displayName} avançou para ${statuses.find((status) => status.id === statusId)?.name ?? 'a nova etapa'}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível movimentar o lead.');
    } finally {
      setMoving(false);
      setDraggingLeadId(null);
    }
  };

  if (loadingStatuses || loadingLeads) return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">PÓS-VENDA</p><h1>Kanban comercial</h1><p className="page-subtitle">Carregando jornada dos leads...</p></div></div></div>;

  return <div className="page-stack kanban-page">
    <div className="page-heading kanban-page-heading">
      <div><p className="eyebrow">PÓS-VENDA</p><h1>{isAdmin ? 'Kanban comercial' : 'Meu Kanban'}</h1><p className="page-subtitle">Acompanhe a jornada depois da visita sem acessar o conteúdo das conversas.</p></div>
      <div className="kanban-summary"><div><strong>{visibleLeads.length}</strong><span>leads visíveis</span></div><div><strong>{visibleLeads.filter((lead) => lead.metrics.noFollowup).length}</strong><span>sem follow-up</span></div><div><strong>{visibleLeads.filter((lead) => lead.metrics.temperature === 'hot').length}</strong><span>quentes</span></div></div>
    </div>

    <div className="kanban-toolbar">
      <label className="kanban-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, código, contato ou setor" /></label>
      {isAdmin && <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}><option value="all">Todos os vendedores</option>{vendors.filter((vendor) => vendor.active).map((vendor) => <option value={vendor.id} key={vendor.id}>{vendor.name}</option>)}</select>}
      <select value={temperatureFilter} onChange={(event) => setTemperatureFilter(event.target.value as 'all' | LeadTemperature)}><option value="all">Todas as temperaturas</option><option value="hot">Quentes</option><option value="warm">Mornos</option><option value="cold">Frios</option><option value="stopped">Parados</option><option value="unknown">Sem leitura</option></select>
      <label className="checkbox-filter"><input type="checkbox" checked={onlyNoFollowup} onChange={(event) => setOnlyNoFollowup(event.target.checked)} /> Somente sem follow-up</label>
    </div>

    <div className="kanban-board" aria-busy={moving}>
      {statuses.map((status) => {
        const columnLeads = visibleLeads.filter((lead) => lead.statusId === status.id);
        return <section
          className={`kanban-column ${draggingLeadId ? 'kanban-column-drop-ready' : ''}`}
          key={status.id}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
          onDrop={(event) => { event.preventDefault(); const leadId = event.dataTransfer.getData('text/plain') || draggingLeadId; if (leadId) void moveLead(leadId, status.id); }}
        >
          <header><div><span className={`status-dot status-${status.colorKey}`} /><strong>{status.name}</strong></div><span className="column-count">{columnLeads.length}</span></header>
          <div className="kanban-column-body">
            {columnLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedLeadId(lead.id)} onDragStart={() => setDraggingLeadId(lead.id)} />)}
            {!columnLeads.length && <div className="kanban-empty">Arraste um lead para esta etapa</div>}
          </div>
        </section>;
      })}
    </div>

    <LeadDetailDialog lead={selectedLead} statuses={statuses} isAdmin={Boolean(isAdmin)} onClose={() => setSelectedLeadId(null)} />
  </div>;
}
