import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from './components/layout/AppLayout';
import { AuditPage } from './pages/AuditPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { WhatsAppsPage } from './pages/WhatsAppsPage';
import './styles/index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
function Protected({ children }: { children: React.ReactNode }) { return <AppLayout>{children}</AppLayout>; }
export function App() { return <QueryClientProvider client={queryClient}><BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="/whatsapps" element={<Protected><WhatsAppsPage /></Protected>} /><Route path="/whatsapps/:accountId/conversations" element={<Protected><ConversationsPage /></Protected>} /><Route path="/whatsapps/:accountId/conversations/:conversationId" element={<Protected><ConversationsPage /></Protected>} /><Route path="/audit" element={<Protected><AuditPage /></Protected>} /><Route path="/settings" element={<Protected><SettingsPage /></Protected>} /><Route path="*" element={<Navigate to="/whatsapps" replace />} /></Routes></BrowserRouter><Toaster position="bottom-right" richColors /></QueryClientProvider>; }
