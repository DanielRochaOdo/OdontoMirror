import { useQuery } from '@tanstack/react-query';
import { whatsappApi } from '../../lib/api';
import '../../styles/sync-progress.css';

export function ApiHealthBadge() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: () => whatsappApi.health(),
    refetchInterval: 5_000,
    retry: 0,
  });

  const online = health.data?.ok === true && !health.isError;
  const checking = health.isPending;
  const label = checking ? 'API verificando...' : online ? 'API online' : 'API offline';
  const title = health.isError && health.error instanceof Error
    ? health.error.message
    : online
      ? 'Backend conectado e respondendo.'
      : 'Não foi possível alcançar o backend.';

  return <span className={`api-health-badge ${online ? 'api-health-online' : checking ? 'api-health-checking' : 'api-health-offline'}`} title={title} aria-live="polite">
    <i /> {label}
  </span>;
}
