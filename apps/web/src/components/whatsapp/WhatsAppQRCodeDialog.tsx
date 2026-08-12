import { CheckCircle2, Copy, QrCode, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { WhatsAppAccount } from '../../types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

export function WhatsAppQRCodeDialog({ account, open, onClose }: { account: WhatsAppAccount | null; open: boolean; onClose: () => void }) {
  const [connected, setConnected] = useState(false);
  useEffect(() => { if (open) setConnected(false); }, [open]);
  if (!account) return null;
  return <Dialog open={open} onClose={onClose} title={connected ? 'WhatsApp conectado' : `Conectar ${account.name}`} description={connected ? 'A sessão foi vinculada ao painel com sucesso.' : 'Use o celular corporativo para escanear o código.'} width="440px"><div className="qr-content">{connected ? <div className="success-state"><div className="success-icon"><CheckCircle2 size={34} /></div><strong>Conexão confirmada</strong><span>As mensagens começarão a ser sincronizadas em alguns instantes.</span></div> : <><div className="qr-frame"><div className="fake-qr" aria-label="QR Code demonstrativo"><QrCode size={146} strokeWidth={1.2} /><span>QR</span></div></div><div className="qr-status"><span className="status-pulse" /> Aguardando leitura...</div><p className="qr-help">Abra o WhatsApp no celular, acesse <strong>Configurações › Aparelhos conectados</strong> e toque em “Conectar aparelho”.</p><div className="qr-actions"><Button variant="outline" size="sm" onClick={() => toast.info('Um novo QR Code foi solicitado.')}><RefreshCw size={15} /> Gerar novo</Button><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText('mirror-desk-qr-demo'); toast.success('Código copiado'); }}><Copy size={15} /> Copiar código</Button></div><Button className="demo-connect" variant="secondary" size="sm" onClick={() => setConnected(true)}>Simular conexão demo</Button></>}</div></Dialog>;
}
