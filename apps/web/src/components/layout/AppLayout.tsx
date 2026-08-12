import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';

export function AppLayout({ children }: { children: ReactNode }) { return <div className="app-shell"><AppSidebar /><main className="main-shell"><Topbar /><div className="page-container">{children}</div></main></div>; }
