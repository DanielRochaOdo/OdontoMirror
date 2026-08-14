import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ThemeToggle } from '../theme/ThemeToggle';

export function Topbar() {
  const location = useLocation();
  const isKanban = location.pathname.startsWith('/kanban');
  const isVendors = location.pathname.startsWith('/vendors');
  const title = location.pathname.startsWith('/audit')
    ? 'Auditoria'
    : location.pathname.startsWith('/settings')
      ? 'Configurações'
      : isVendors
        ? 'Vendedores'
        : isKanban
          ? 'Jornada comercial'
          : 'WhatsApps corporativos';
  return <header className="topbar"><div className="topbar-title"><span className="topbar-dot" /><span>{title}</span></div><div className="topbar-actions"><span className="readonly-note" style={{ margin: 0 }}>{isKanban ? <><ShieldCheck size={14} /> Conversas protegidas</> : <><LockKeyhole size={14} /> Somente leitura</>}</span><ThemeToggle /></div></header>;
}
