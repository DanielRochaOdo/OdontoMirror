import { FileClock, LogOut, MessageSquareText, PanelLeftClose, PanelLeftOpen, Settings2, ShieldCheck } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/app-store';

export function AppSidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggle = useAppStore((state) => state.toggleSidebar);
  const navigate = useNavigate();
  const links = [{ to: '/whatsapps', label: 'WhatsApps', icon: MessageSquareText }, { to: '/audit', label: 'Auditoria', icon: FileClock }, { to: '/settings', label: 'Configurações', icon: Settings2 }];
  return <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <div className="brand"><div className="brand-mark"><ShieldCheck size={19} /></div>{!collapsed && <div><strong>MirrorDesk</strong><span>auditoria corporativa</span></div>}</div>
    <div className="sidebar-section-label">{!collapsed && 'Workspace'}</div>
    <nav className="nav-list">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} title={collapsed ? label : undefined}><Icon size={18} /><span>{!collapsed && label}</span>{label === 'WhatsApps' && !collapsed && <span className="nav-count">3</span>}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="profile-chip"><div className="avatar avatar-small avatar-indigo">DR</div>{!collapsed && <div><strong>Daniel Rocha</strong><span>Administrador</span></div>}</div><button className="logout-button" title="Sair" onClick={() => navigate('/login')}><LogOut size={17} />{!collapsed && <span>Sair</span>}</button><button className="collapse-button" onClick={toggle} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
  </aside>;
}
