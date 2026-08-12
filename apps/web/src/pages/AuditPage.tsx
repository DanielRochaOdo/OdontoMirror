import { Download, FileClock, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuditLogs } from '../hooks/queries';
import { formatRelativeDate, titleFromAction } from '../lib/utils';

function csvCell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export function AuditPage() {
  const { data: logs = [] } = useAuditLogs();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const actions = useMemo(() => [...new Set(logs.map((log) => log.action))].sort(), [logs]);
  const filtered = logs.filter((log) => (action === 'all' || log.action === action) && `${log.action} ${log.entityLabel} ${log.adminName}`.toLowerCase().includes(search.toLowerCase()));
  const exportCsv = () => {
    const rows = [['Evento', 'Recurso', 'Administrador', 'WhatsApp', 'Data'], ...filtered.map((log) => [titleFromAction(log.action), log.entityLabel, log.adminName, log.whatsappAccountName ?? '', new Date(log.createdAt).toLocaleString('pt-BR')])];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `auditoria-mirrordesk-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">CONTROLE E RASTREABILIDADE</p><h1>Auditoria</h1><p className="page-subtitle">Acompanhe as ações realizadas no painel administrativo.</p></div><Button variant="outline" onClick={exportCsv}><Download size={16} /> Exportar relatório</Button></div><div className="audit-summary"><div className="audit-summary-icon"><ShieldCheck size={20} /></div><div><strong>Auditoria ativa</strong><span>As visualizações importantes são registradas sem copiar o conteúdo das mensagens para os logs.</span></div><Badge tone="green">Protegido</Badge></div><section className="content-panel"><div className="panel-toolbar"><div><h2>Atividade recente</h2><p>{filtered.length} eventos exibidos</p></div><div className="toolbar-actions"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar evento..." /></label><select value={action} onChange={(event) => setAction(event.target.value)} aria-label="Filtrar por ação"><option value="all">Todas as ações</option>{actions.map((item) => <option value={item} key={item}>{titleFromAction(item)}</option>)}</select></div></div><div className="audit-table"><div className="table-head"><span>EVENTO</span><span>RECURSO</span><span>ADMINISTRADOR</span><span>DATA E HORA</span></div>{filtered.map((log) => <div className="audit-row" key={log.id}><div className="audit-event"><div className="audit-event-icon"><FileClock size={16} /></div><div><strong>{titleFromAction(log.action)}</strong><span>Registro de segurança</span></div></div><div><span className="audit-resource">{log.entityLabel}</span></div><div><span className="audit-admin">{log.adminName}</span></div><time>{formatRelativeDate(log.createdAt)}</time></div>)}</div></section></div>;
}
