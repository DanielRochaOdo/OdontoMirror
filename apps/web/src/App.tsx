import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { RequireAdmin } from './components/auth/RequireAdmin';
import { RequireCommercial } from './components/auth/RequireCommercial';
import { AuditPage } from './pages/AuditPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { KanbanPage } from './pages/KanbanPage';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SettingsPage } from './pages/SettingsPage';
import { VendorDetailPage } from './pages/VendorDetailPage';
import { VendorsPage } from './pages/VendorsPage';
import { WhatsAppsPage } from './pages/WhatsAppsPage';
import './styles/index.css';
import './styles/theme.css';
import './styles/commercial.css';
import './styles/commercial-controls.css';
import './styles/commercial-linking.css';
import './styles/vendor-admin.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/kanban" element={<RequireCommercial><KanbanPage /></RequireCommercial>} />
    <Route path="/whatsapps" element={<RequireAdmin><WhatsAppsPage /></RequireAdmin>} />
    <Route path="/whatsapps/:accountId/conversations" element={<RequireAdmin><ConversationsPage /></RequireAdmin>} />
    <Route path="/whatsapps/:accountId/conversations/:conversationId" element={<RequireAdmin><ConversationsPage /></RequireAdmin>} />
    <Route path="/vendors" element={<RequireAdmin><VendorsPage /></RequireAdmin>} />
    <Route path="/vendors/:vendorId" element={<RequireAdmin><VendorDetailPage /></RequireAdmin>} />
    <Route path="/audit" element={<RequireAdmin><AuditPage /></RequireAdmin>} />
    <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></BrowserRouter><Toaster position="bottom-right" richColors /></QueryClientProvider>;
}
