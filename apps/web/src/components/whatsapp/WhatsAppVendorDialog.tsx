import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { History, Search, Unlink, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useCommercialVendors } from '../../hooks/queries';
import { useWhatsAppVendorAssignmentHistory } from '../../hooks/vendorOwnership';
import { assignWhatsAppVendor, unlinkWhatsAppVendor } from '../../lib/vendorOwnership';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

interface WhatsAppVendorDialogProps {
  open: boolean;
  account: { id: string; name: string; phoneNumber: string } | null;
  currentVendorId?: string;
  onClose: () => void;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function WhatsAppVendorDialog({ open, account, currentVendorId, onClose }: WhatsAppVendorDialogProps) {
  const queryClient = useQueryClient();
  const { data: vendors = [] } = useCommercialVendors();
  const { data: history = [] } = useWhatsAppVendorAssignmentHistory(account?.id);
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState(currentVendorId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedVendorId(currentVendorId ?? '');
    }
  }, [currentVendorId, open]);

  const visibleVendors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return vendors.filter((vendor) => vendor.active && (!needle || `${vendor.name} ${vendor.email ?? ''}`.toLowerCase().includes(needle)));
  }, [search, vendors]);

  if (!account) return null;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['whatsapp-vendor-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['whatsapp-vendor-assignment-history', account.id] }),
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] }),
    ]);
  };

  const save = async () => {
    if (!selectedVendorId) return toast.error('Selecione um vendedor.');
    setSaving(true);
    try {
      await assignWhatsAppVendor(account.id, selectedVendorId);
      await refresh();
      toast.success(currentVendorId ? 'Responsável do WhatsApp atualizado.' : 'Vendedor vinculado ao WhatsApp.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o vendedor.');
    } finally { setSaving(false); }
  };

  const unlink = async () => {
    if (!currentVendorId) return;
    if (!window.confirm(`Remover o responsável atual do número ${account.phoneNumber}?`)) return;
    setSaving(true);
    try {
      await unlinkWhatsAppVendor(account.id);
      await refresh();
      toast.success('Vínculo removido. O histórico foi preservado.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o vínculo.');
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={onClose} title="Responsável pelo WhatsApp" description={`${account.name} · ${account.phoneNumber}`} width="720px">
    <div className="vendor-assignment-dialog">
      <section className="vendor-assignment-section">
        <div className="section-title-row"><UserRound size={17} /><div><h3>Vendedor atual</h3><p>Este vínculo identifica quem utiliza o número corporativo. Ele não altera as responsabilidades dos leads no Rotas.</p></div></div>
        <label className="kanban-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar vendedor por nome ou e-mail" /></label>
        <div className="vendor-picker-list">
          {visibleVendors.map((vendor) => <label className={`vendor-picker-item ${selectedVendorId === vendor.id ? 'selected' : ''}`} key={vendor.id}>
            <input type="radio" name="whatsapp-vendor" value={vendor.id} checked={selectedVendorId === vendor.id} onChange={() => setSelectedVendorId(vendor.id)} />
            <div className="avatar avatar-small avatar-indigo">{vendor.name.slice(0, 2).toUpperCase()}</div>
            <div><strong>{vendor.name}</strong><span>{vendor.email ?? 'E-mail não informado'}</span></div>
          </label>)}
          {!visibleVendors.length && <p className="empty-copy">Nenhum vendedor ativo encontrado.</p>}
        </div>
        <div className="vendor-assignment-actions">
          {currentVendorId && <Button variant="secondary" disabled={saving} onClick={() => void unlink()}><Unlink size={15} /> Remover vínculo</Button>}
          <Button disabled={saving || !selectedVendorId || selectedVendorId === currentVendorId} onClick={() => void save()}>{saving ? 'Salvando...' : currentVendorId ? 'Trocar responsável' : 'Vincular vendedor'}</Button>
        </div>
      </section>

      <section className="vendor-assignment-section">
        <div className="section-title-row"><History size={17} /><div><h3>Histórico do número</h3><p>Transferências anteriores permanecem disponíveis para auditoria.</p></div></div>
        <div className="ownership-history-list">
          {history.map((item) => <div className="ownership-history-item" key={item.id}><span className="timeline-dot" /><div><strong>{item.vendorName}</strong><span>{item.vendorEmail ?? 'Sem e-mail'}</span><p>{formatDateTime(item.startedAt)} → {formatDateTime(item.endedAt)} · {item.changeReason === 'transfer' ? 'transferido' : 'desvinculado'}{item.changedByName ? ` por ${item.changedByName}` : ''}</p></div></div>)}
          {!history.length && <p className="empty-copy">Nenhuma transferência anterior registrada.</p>}
        </div>
      </section>
    </div>
  </Dialog>;
}
