import { CheckCircle2, CircleAlert, LoaderCircle, QrCode } from 'lucide-react';
import type { WhatsAppStatus } from '../../types';
import { Badge } from '../ui/badge';

const labels: Record<WhatsAppStatus, string> = { connected: 'Conectado', disconnected: 'Desconectado', connecting: 'Conectando', reconnecting: 'Reconectando', qr_required: 'QR necessário', error: 'Com erro' };
export function WhatsAppStatusBadge({ status }: { status: WhatsAppStatus }) { const Icon = status === 'connected' ? CheckCircle2 : status === 'qr_required' ? QrCode : status === 'disconnected' || status === 'error' ? CircleAlert : LoaderCircle; const tone = status === 'connected' ? 'green' : status === 'disconnected' || status === 'error' ? 'red' : 'orange'; return <Badge tone={tone}><Icon size={13} className={status === 'connecting' || status === 'reconnecting' ? 'spin' : ''} /> {labels[status]}</Badge>; }
