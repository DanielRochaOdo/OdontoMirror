import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { whatsappApi, type CreatedWhatsAppAccount } from '../../lib/api';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

const schema = z.object({ name: z.string().min(2, 'Informe um nome para o número').max(80), description: z.string().max(120, 'Use até 120 caracteres').optional() });
type FormData = z.infer<typeof schema>;

export function AddWhatsAppDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (account: CreatedWhatsAppAccount) => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const submit = async (data: FormData) => {
    try {
      const account = await whatsappApi.createAccount({ name: data.name, description: data.description || undefined });
      toast.success(`${data.name} criado. Escaneie o QR Code para conectar.`);
      reset();
      onClose();
      onCreated(account);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar a conexão.');
    }
  };
  return <Dialog open={open} onClose={onClose} title="Adicionar WhatsApp" description="Cadastre um número corporativo e conecte-o por QR Code."><form className="dialog-form" onSubmit={handleSubmit(submit)}><label>Nome do número<input placeholder="Ex.: SAC Messejana" {...register('name')} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label><label>Descrição <span className="optional">opcional</span><textarea rows={3} placeholder="Ex.: Atendimento da unidade Messejana" {...register('description')} />{errors.description && <small className="field-error">{errors.description.message}</small>}</label><div className="dialog-note"><Plus size={16} /><span>Após criar, o backend iniciará a sessão e exibirá o QR Code real do WhatsApp.</span></div><div className="dialog-footer"><Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Criando...' : 'Criar conexão'}</Button></div></form></Dialog>;
}
