import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

const schema = z.object({ name: z.string().min(2, 'Informe um nome para o número'), description: z.string().max(120, 'Use até 120 caracteres').optional() });
type FormData = z.infer<typeof schema>;
export function AddWhatsAppDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const submit = async (data: FormData) => { await new Promise((resolve) => setTimeout(resolve, 400)); toast.success(`${data.name} está pronto para conexão.`); reset(); onClose(); onCreated(); };
  return <Dialog open={open} onClose={onClose} title="Adicionar WhatsApp" description="Cadastre um número corporativo para iniciar uma nova sessão."><form className="dialog-form" onSubmit={handleSubmit(submit)}><label>Nome do número<input placeholder="Ex.: SAC Messejana" {...register('name')} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label><label>Descrição <span className="optional">opcional</span><textarea rows={3} placeholder="Ex.: Atendimento da unidade Messejana" {...register('description')} />{errors.description && <small className="field-error">{errors.description.message}</small>}</label><div className="dialog-note"><Plus size={16} /><span>Após criar, um QR Code será gerado para vincular o celular corporativo.</span></div><div className="dialog-footer"><Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Criando...' : 'Criar conexão'}</Button></div></form></Dialog>;
}
