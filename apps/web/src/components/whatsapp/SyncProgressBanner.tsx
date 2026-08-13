import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { whatsappApi, type SyncProgress } from '../../lib/api';
import '../../styles/sync-progress.css';

function elapsedLabel(startedAt: string | null, now: number) {
  if (!startedAt) return 'aguardando início';
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s decorridos`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}min ${remainingSeconds.toString().padStart(2, '0')}s decorridos`;
}

export function SyncProgressBanner({ accountId, accountName, onFinished, onClose }: {
  accountId: string;
  accountName: string;
  onFinished?: (progress: SyncProgress) => void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const notifiedStatus = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ['whatsapp-sync-progress', accountId],
    queryFn: () => whatsappApi.syncStatus(accountId),
    refetchInterval: (state) => state.state.data?.status === 'running' || state.state.data?.status === 'idle' ? 1_000 : false,
    retry: 1,
  });

  const progress = query.data;
  const isRunning = !progress || progress.status === 'idle' || progress.status === 'running';

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!progress || (progress.status !== 'completed' && progress.status !== 'failed')) return;
    const marker = `${accountId}:${progress.status}:${progress.completedAt ?? progress.updatedAt}`;
    if (notifiedStatus.current === marker) return;
    notifiedStatus.current = marker;
    onFinished?.(progress);
  }, [accountId, onFinished, progress]);

  const elapsed = useMemo(() => elapsedLabel(progress?.startedAt ?? null, now), [now, progress?.startedAt]);
  const status = query.isError ? 'error' : progress?.status ?? 'running';

  return <section className={`sync-progress-banner sync-progress-${status}`} aria-live="polite">
    <div className="sync-progress-heading">
      <span className="sync-progress-icon">
        {status === 'completed' ? <CheckCircle2 size={18} /> : status === 'failed' || status === 'error' ? <AlertCircle size={18} /> : <LoaderCircle className="spin" size={18} />}
      </span>
      <div>
        <strong>{status === 'completed' ? `Sincronização de ${accountName} concluída` : status === 'failed' ? `Sincronização de ${accountName} falhou` : status === 'error' ? 'Não foi possível consultar o andamento' : `Sincronizando ${accountName}`}</strong>
        <span>{status === 'completed' ? 'Conversas, mensagens e mídias disponíveis foram processadas.' : status === 'failed' ? progress?.error ?? 'O backend encerrou a sincronização com erro.' : status === 'error' ? (query.error instanceof Error ? query.error.message : 'Backend indisponível.') : `Processando conversas, mensagens e mídias · ${elapsed}`}</span>
      </div>
      {!isRunning && <button type="button" className="sync-progress-close" onClick={onClose} aria-label="Fechar andamento"><X size={16} /></button>}
    </div>
    <div className={`sync-progress-track ${isRunning ? 'sync-progress-track-running' : ''}`}>
      <span />
    </div>
  </section>;
}
