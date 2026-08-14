import { Columns3, FileClock, LogOut, MessageSquareText, PanelLeftClose, PanelLeftOpen, Settings2, ShieldCheck } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useProfile, useWhatsAppAccounts } from '../../hooks/queries';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../lib/audit';
import { useAppStore } from '../../stores/app-store';

function AdminNavigation({ collapsed }: { collapsed: boolean }) {
  const { data: accounts = [] } = useWhatsAppAccounts();
  const links = [
    { to: '/whatsapps', label: 'WhatsApps', icon: MessageSquareText, count: accounts.length },
    { to: '/kanban', label: 'Kanban', icon: Columns3 },
    { to: '/audit', label: 'Auditoria', icon: FileClock },
    { to: '/settings', label: 'Configurações', icon: Settings2 },
  ];
  return <>{links.map(({ to, label, icon: Icon, count }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} title={collapsed ? label : undefined}><Icon size={18} /><span>{!collapsed && label}</span>{count !== undefined && !collapsed && <span className="nav-count">{count}</span>}</NavLink>)}</>;
}

function SellerNavigation({ collapsed }: { collapsed: boolean }) {
  return <NavLink to="/kanban" className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} title={collapsed ? 'Meu Kanban' : undefined}><Columns3 size={18} /><span>{!collapsed && 'Meu Kanban'}</span></NavLink>;
}

export function AppSidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggle = useAppStore((state) => state.toggleSidebar);
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const initials = (profile?.name ?? 'Usuário').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const isAdmin = profile?.role === 'admin';
  const roleLabel = isAdmin ? 'Administrador' : 'Vendedor';

  const logout = async () => {
    if (isAdmin && profile?.id) await logAuditEvent('LOGOUT', 'admin', profile.id, undefined, { entity_label: profile.name });
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <div className="brand"><div className="brand-mark"><ShieldCheck size={19} /></div>{!collapsed && <div><strong>MirrorDesk</strong><span>{isAdmin ? 'auditoria corporativa' : 'acompanhamento comercial'}</span></div>}</div>
    <div className="sidebar-section-label">{!collapsed && (isAdmin ? 'Workspace' : 'Comercial')}</div>
    <nav className="nav-list">{isAdmin ? <AdminNavigation collapsed={collapsed} /> : <SellerNavigation collapsed={collapsed} />}</nav>
    <div className="sidebar-bottom"><div className="profile-chip"><div className="avatar avatar-small avatar-indigo">{initials}</div>{!collapsed && <div><strong>{profile?.name ?? roleLabel}</strong><span>{roleLabel}</span></div>}</div><button className="logout-button" title="Sair" onClick={() => void logout()}><LogOut size={17} />{!collapsed && <span>Sair</span>}</button><button className="collapse-button" onClick={toggle} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
  </aside>;
}
