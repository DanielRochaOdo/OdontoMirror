import { ArrowDown, ArrowUp, Check, KeyRound, Plus, RefreshCw, Trash2, UserRound, Workflow } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useKanbanStatuses, useProfile } from '../hooks/queries';
import { commercialApi, type CommercialSyncStatus } from '../lib/api';
import { createKanbanStatus, deleteKanbanStatus, updateKanbanStatus } from '../lib/commercial';
import { supabase } from '../lib/supabase';
import type { KanbanStatus } from '../types';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function KanbanStatusRow({ status, index, total, onRefresh }: {
  status: KanbanStatus;
  index: number;
  total: number;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState(status.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(status.name), [status.name]);

  const patch = async (values: Parameters<typeof updateKanbanStatus>[1]) => {
    setSaving(true);
    try {
      await updateKanbanStatus(status.id, values);
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a etapa.');
    } finally { setSaving(false); }
  };

  const saveName = async () => {
    if (name.trim().length < 2 || name.trim() === status.name) return;
    await patch({ name: name.trim() });
    toast.success('Nome da etapa atualizado.');
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteKanbanStatus(status.id);
      await onRefresh();
      toast.success('Etapa excluída.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a etapa.');
    } finally { setSaving(false); }
  };

  return <div className="kanban-status-row">
    <span className={`status-dot status-${status.colorKey}`} />
    <input type="text" value={name} disabled={saving} onChange={(event) => setName(event.target.value)} onBlur={() => void saveName()} onKeyDown={(event) => { if (event.key === 'Enter') void saveName(); }} />
    <div className="status-order-actions"><button type="button" title="Mover para a esquerda" disabled={saving || index === 0} onClick={() => void patch({ position: Math.max(0, status.position - 15) })}><ArrowUp size={14} /></button><button type="button" title="Mover para a direita" disabled={saving || index === total - 1} onClick={() => void patch({ position: status.position + 15 })}><ArrowDown size={14} /></button></div>
    <label className="checkbox-filter"><input type="checkbox" checked={status.isTerminal} disabled={saving} onChange={(event) => void patch({ isTerminal: event.target.checked })} /> Final</label>
    <label className="checkbox-filter"><input type="checkbox" checked={status.active} disabled={saving} onChange={(event) => void patch({ active: event.target.checked })} /> Ativa</label>
    <button className="status-delete-button" type="button" title="Excluir etapa sem leads" disabled={saving} onClick={() => void remove()}><Trash2 size={14} /></button>
  </div>;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: statuses = [] } = useKanbanStatuses(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncInfo, setSyncInfo] = useState<CommercialSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [addingStatus, setAddingStatus] = useState(false);

  const orderedStatuses = useMemo(() => [...statuses].sort((a, b) => a.position - b.position), [statuses]);
  const lastRun = syncInfo?.runs[0];

  const loadSync = async () => {
    try { setSyncInfo(await commercialApi.syncStatus()); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível consultar a integração com o Rotas.'); }
  };

  useEffect(() => {
    if (profile) setName(profile.name);
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
    void loadSync();
  }, [profile]);

  const refreshStatuses = async () => {
    await queryClient.invalidateQueries({ queryKey: ['commercial-kanban-statuses'] });
  };

  const normalizeStatusPositions = async () => {
    const current = [...orderedStatuses].sort((a, b) => a.position - b.position);
    await Promise.all(current.map((status, index) => updateKanbanStatus(status.id, { position: (index + 1) * 10 })));
    await refreshStatuses();
  };

  const saveProfile = async () => {
    if (!profile || name.trim().length < 2) return toast.error('Informe um nome válido.');
    setSavingProfile(true); setSaved(false);
    const { error: profileError } = await supabase.from('profiles').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', profile.id);
    if (profileError) { setSavingProfile(false); return toast.error(profileError.message); }
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && email.trim() && email.trim() !== user.email) {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) { setSavingProfile(false); return toast.error(error.message); }
      toast.info('Confirme a alteração pelo novo endereço de e-mail, conforme a configuração do Supabase.');
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
    setSavingProfile(false); setSaved(true); toast.success('Perfil atualizado.');
  };

  const changePassword = async () => {
    if (password.length < 8) return toast.error('A nova senha deve ter pelo menos 8 caracteres.');
    if (password !== confirmPassword) return toast.error('As senhas não coincidem.');
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) return toast.error(error.message);
    setPassword(''); setConfirmPassword(''); toast.success('Senha alterada com sucesso.');
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await commercialApi.sync();
      toast.success(`Sincronização concluída: ${result.companiesSynced} empresas, ${result.vendorsSynced} vendedores e ${result.leadsLinked} novos vínculos.`);
      await Promise.all([
        loadSync(),
        queryClient.invalidateQueries({ queryKey: ['commercial-leads'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-vendors'] }),
        queryClient.invalidateQueries({ queryKey: ['commercial-companies'] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar o Rotas.');
    } finally { setSyncing(false); }
  };

  const addStatus = async () => {
    if (newStatusName.trim().length < 2) return toast.error('Informe um nome para a nova etapa.');
    setAddingStatus(true);
    try {
      const maxPosition = orderedStatuses.reduce((max, status) => Math.max(max, status.position), 0);
      await createKanbanStatus({ name: newStatusName.trim(), position: maxPosition + 10 });
      setNewStatusName('');
      await refreshStatuses();
      toast.success('Nova etapa adicionada ao Kanban.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a etapa.');
    } finally { setAddingStatus(false); }
  };

  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">ACESSO ADMINISTRATIVO</p><h1>Configurações</h1><p className="page-subtitle">Gerencie conta, integração com o Rotas e jornada comercial.</p></div></div>
    <section className="settings-section"><div className="settings-section-head"><div className="settings-icon"><Workflow size={18} /></div><div><h2>Integração comercial com o Rotas</h2><p>Empresas, vendedores e responsáveis do Kanban são atualizados automaticamente a partir das visitas.</p></div></div><div className="commercial-settings-grid"><div className="sync-health-row"><div className="sync-health-meta"><span>Integração: <strong>{syncInfo?.configured ? 'Configurada' : 'Não configurada'}</strong></span><span>Última execução: <strong>{formatDateTime(lastRun?.finished_at ?? lastRun?.started_at)}</strong></span><span>Resultado: <strong>{lastRun?.status === 'success' ? 'Sucesso' : lastRun?.status === 'running' ? 'Em andamento' : lastRun?.status === 'error' ? 'Erro' : '—'}</strong></span></div><Button disabled={syncing || !syncInfo?.configured} onClick={() => void runSync()}><RefreshCw size={16} className={syncing ? 'spin-icon' : ''} /> {syncing ? 'Sincronizando...' : 'Sincronizar agora'}</Button></div>{lastRun?.status === 'success' && <div className="sync-health-meta"><span>{lastRun.vendors_synced} vendedores</span><span>{lastRun.companies_synced} empresas</span><span>{lastRun.visits_synced} visitas</span><span>{lastRun.leads_linked} novos leads vinculados</span><span>{lastRun.assignments_changed} alterações de responsáveis</span></div>}{lastRun?.error_message && <p className="field-error">{lastRun.error_message}</p>}</div></section>

    <section className="settings-section"><div className="settings-section-head"><div className="settings-icon"><Workflow size={18} /></div><div><h2>Etapas do Kanban</h2><p>O administrador define a jornada; vendedores apenas movimentam seus leads entre estas etapas.</p></div></div><div className="commercial-settings-grid"><div className="kanban-status-list">{orderedStatuses.map((status, index) => <KanbanStatusRow key={status.id} status={status} index={index} total={orderedStatuses.length} onRefresh={async () => { await normalizeStatusPositions(); }} />)}</div><div className="new-status-row"><input value={newStatusName} onChange={(event) => setNewStatusName(event.target.value)} placeholder="Nome da nova etapa" onKeyDown={(event) => { if (event.key === 'Enter') void addStatus(); }} /><Button disabled={addingStatus || newStatusName.trim().length < 2} onClick={() => void addStatus()}><Plus size={16} /> Adicionar etapa</Button></div></div></section>

    <section className="settings-section"><div className="settings-section-head"><div className="settings-icon"><UserRound size={18} /></div><div><h2>Perfil administrativo</h2><p>Nome e e-mail do usuário autenticado</p></div></div><div className="settings-form-grid"><label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label><label>Cargo<input value="Administrador" disabled /></label></div><div className="settings-actions"><span>{saved && <><Check size={15} /> Alterações salvas</>}</span><Button disabled={savingProfile} onClick={() => void saveProfile()}>{savingProfile ? 'Salvando...' : 'Salvar perfil'}</Button></div></section>

    <section className="settings-section"><div className="settings-section-head"><div className="settings-icon"><KeyRound size={18} /></div><div><h2>Alterar senha</h2><p>Atualize a senha da conta administrativa autenticada no Supabase.</p></div></div><div className="settings-form-grid"><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div><div className="settings-actions"><span /><Button disabled={savingPassword || !password} onClick={() => void changePassword()}>{savingPassword ? 'Alterando...' : 'Alterar senha'}</Button></div></section>
  </div>;
}
