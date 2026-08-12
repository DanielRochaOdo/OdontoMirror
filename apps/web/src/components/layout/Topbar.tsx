import { Bell, HelpCircle, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function Topbar() {
  const location = useLocation();
  const title = location.pathname.startsWith('/audit') ? 'Auditoria' : location.pathname.startsWith('/settings') ? 'Configurações' : 'WhatsApps corporativos';
  return <header className="topbar"><div className="topbar-title"><LayoutIcon /> <span>{title}</span></div><div className="topbar-actions"><label className="global-search"><Search size={16} /><input placeholder="Buscar no MirrorDesk" aria-label="Buscar no MirrorDesk" /></label><button className="icon-button" aria-label="Ajuda"><HelpCircle size={19} /></button><button className="icon-button notification-button" aria-label="Notificações"><Bell size={19} /><i /></button></div></header>;
}

function LayoutIcon() { return <span className="topbar-dot" />; }
