import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { logAuditEvent } from '../lib/audit';

const schema = z.object({ email: z.string().email('Informe um e-mail válido'), password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres') });
type LoginData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginData>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', data.session.user.id).maybeSingle();
      if (profile?.role === 'admin' && profile.active === true) navigate('/whatsapps', { replace: true });
      else await supabase.auth.signOut();
    });
  }, [navigate]);

  const onSubmit = async (data: LoginData) => {
    const { data: auth, error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    if (error) return toast.error('E-mail ou senha inválidos.');
    const { data: profile } = await supabase.from('profiles').select('role,active,name').eq('id', auth.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin' || profile.active !== true) {
      await supabase.auth.signOut();
      return toast.error('Este usuário não possui acesso administrativo ativo.');
    }
    await logAuditEvent('LOGIN', 'admin', auth.user.id, undefined, { entity_label: profile.name ?? auth.user.email ?? 'Administrador' });
    navigate('/whatsapps', { replace: true });
  };

  const recover = async () => {
    const email = getValues('email');
    if (!email) return toast.error('Informe seu e-mail antes de solicitar a recuperação.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return toast.error(error.message);
    toast.success('Enviamos o link de recuperação para o e-mail informado.');
  };

  return <div className="login-shell"><div className="login-visual"><div className="login-visual-content"><div className="brand brand-light"><div className="brand-mark"><ShieldCheck size={19} /></div><div><strong>MirrorDesk</strong><span>auditoria corporativa</span></div></div><div className="visual-copy"><p className="eyebrow">PAINEL DE CONFERÊNCIA</p><h1>Clareza para cada conversa corporativa.</h1><p>Um espaço seguro para consultar o histórico dos números oficiais com rastreabilidade e controle.</p></div><div className="visual-stat"><span className="stat-pulse" /><div><strong>Ambiente protegido</strong><small>Somente leitura · acesso administrativo</small></div></div></div><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-grid" /></div><main className="login-card-wrap"><div className="login-card"><div className="mobile-brand brand"><div className="brand-mark"><ShieldCheck size={19} /></div><strong>MirrorDesk</strong></div><div className="login-heading"><span className="login-icon"><LockKeyhole size={19} /></span><p className="eyebrow">ACESSO ADMINISTRATIVO</p><h2>Bem-vindo de volta</h2><p>Entre para acessar o painel de conferência.</p></div><form onSubmit={handleSubmit(onSubmit)} className="login-form"><label>E-mail<input type="email" placeholder="admin@empresa.com.br" autoComplete="email" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label><label>Senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label><div className="form-meta"><span /><button type="button" className="link-button" onClick={() => void recover()}>Esqueci minha senha</button></div><Button type="submit" size="lg" disabled={isSubmitting}>{isSubmitting ? 'Autenticando...' : 'Entrar no painel'} {!isSubmitting && <ArrowRight size={17} />}</Button></form><p className="login-footnote"><ShieldCheck size={14} /> Seus acessos e visualizações são registrados para auditoria.</p></div><footer>© 2026 MirrorDesk · Ambiente corporativo</footer></main></div>;
}
