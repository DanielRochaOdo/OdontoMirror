import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error('Use pelo menos 8 caracteres.');
    if (password !== confirm) return toast.error('As senhas não coincidem.');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Senha atualizada com sucesso.');
    navigate('/whatsapps', { replace: true });
  };
  return <div className="login-shell reset-password-shell"><div className="login-theme-toggle"><ThemeToggle /></div><main className="login-card-wrap"><div className="login-card"><div className="brand"><div className="brand-mark"><ShieldCheck size={19} /></div><strong>Odontoart Connect</strong></div><div className="login-heading"><h2>Definir nova senha</h2><p>Informe a nova senha da sua conta administrativa.</p></div><form className="login-form" onSubmit={submit}><label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirmar senha<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><Button type="submit" size="lg" disabled={saving}>{saving ? 'Salvando...' : 'Atualizar senha'}</Button></form></div></main></div>;
}
