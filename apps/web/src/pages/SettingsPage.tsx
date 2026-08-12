import { Check, KeyRound, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { useProfile } from '../hooks/queries';
import { supabase } from '../lib/supabase';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (profile) setName(profile.name); void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, [profile]);

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

  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">ACESSO ADMINISTRATIVO</p><h1>Configurações</h1><p className="page-subtitle">Gerencie os dados reais da sua conta administrativa.</p></div></div><section className="settings-section"><div className="settings-section-head"><div className="settings-icon"><UserRound size={18} /></div><div><h2>Perfil administrativo</h2><p>Nome e e-mail do usuário autenticado</p></div></div><div className="settings-form-grid"><label>Nome completo<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>E-mail<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label><label>Cargo<input value="Administrador" disabled /></label></div><div className="settings-actions"><span>{saved && <><Check size={15} /> Alterações salvas</>}</span><Button disabled={savingProfile} onClick={() => void saveProfile()}>{savingProfile ? 'Salvando...' : 'Salvar perfil'}</Button></div></section><section className="settings-section"><div className="settings-section-head"><div className="settings-icon"><KeyRound size={18} /></div><div><h2>Alterar senha</h2><p>Atualize a senha da conta autenticada no Supabase.</p></div></div><div className="settings-form-grid"><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label></div><div className="settings-actions"><span /><Button disabled={savingPassword || !password} onClick={() => void changePassword()}>{savingPassword ? 'Alterando...' : 'Alterar senha'}</Button></div></section></div>;
}
