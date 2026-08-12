import { CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { whatsappApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

export interface QRTarget { id: string; name: string; }

export function WhatsAppQRCodeDialog({ account, open, onClose, onConnected }: { account: QRTarget | null; open: boolean; onClose: () => void; onConnected?: () => void }) {
  const [status, setStatus] = useState('connecting');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const statusResult = await whatsappApi.status(account.id);
      setStatus(statusResult.status);
      if (statusResult.status === 'connected') {
        setQrCode(null);
        onConnected?.();
        return;
      }
      const qrResult = await whatsappApi.qr(account.id);
      setQrCode(qrResult.qrCode);
    } catch (error) {
      setStatus('error');
      toast.error(error instanceof Error ? error.message : 'Falha ao consultar a sessão.');
    }
  }, [account, onConnected]);

  useEffect(() => {
    if (!open || !account) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [open, account, refresh]);

  if (!account) return null;
  const reconnect = async () => {
    setLoading(true);
    try { await whatsappApi.connect(account.id); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : 'Falha ao reiniciar a conexão.'); }
    finally { setLoading(false); }
  };

  const connected = status === 'connected';
  return <Dialog open={open} onClose={onClose} title={connected ? 'WhatsApp conectado' : `Conectar ${account.name}`} description={connected ? 'A sessão está ativa e a sincronização foi iniciada.' : 'Use o celular corporativo para escanear o código.'} width="440px"><div className="qr-content">{connected ? <div className="success-state"><div className="success-icon"><CheckCircle2 size={34} /></div><strong>Conexão confirmada</strong><span>As conversas e novas mensagens serão sincronizadas para o painel.</span><Button onClick={onClose}>Concluir</Button></div> : <><div className="qr-frame">{qrCode ? <img src={qrCode} alt="QR Code para conectar o WhatsApp corporativo" style={{ width: 230, height: 230 }} /> : <div className="fake-qr" aria-label="Gerando QR Code"><QrCode size={100} strokeWidth={1.2} /><span>{status === 'error' ? 'Erro' : 'Gerando...'}</span></div>}</div><div className="qr-status"><span className="status-pulse" /> {status === 'qr_required' ? 'Aguardando leitura...' : status === 'error' ? 'Falha na sessão' : 'Conectando...'}</div><p className="qr-help">Abra o WhatsApp no celular corporativo, acesse <strong>Configurações › Aparelhos conectados</strong> e toque em “Conectar aparelho”.</p><div className="qr-actions"><Button variant="outline" size="sm" disabled={loading} onClick={() => void reconnect()}><RefreshCw size={15} /> {loading ? 'Reiniciando...' : 'Gerar / reconectar'}</Button></div></>}</div></Dialog>;
}
