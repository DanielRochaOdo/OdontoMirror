import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { ThemeToggle } from '../components/theme/ThemeToggle';
import { Button } from '../components/ui/button';
import { logAuditEvent } from '../lib/audit';
import { authApi } from '../lib/api';
import { supabase } from '../lib/supabase';

const schema = z.object({ email: z.string().email('Informe um e-mail válido'), password: z.string().optional() });
type LoginData = z.infer<typeof schema>;
type LoginMode = 'admin' | 'seller';

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<LoginMode>('admin');
  const [sellerSigningIn, setSellerSigningIn] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginData>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: profile } = await supabase.from('profiles').select('role,active').eq('id', data.session.user.id).maybeSingle();
      if (profile?.active === true && profile.role === 'admin') navigate('/whatsapps', { replace: true });
      else if (profile?.active === true && profile.role === 'seller') navigate('/kanban', { replace: true });
      else await supabase.auth.signOut();
    });
  }, [navigate]);

  const onSubmit = async (data: LoginData) => {
    if (!data.password) {
      return toast.error(mode === 'seller' ? 'Informe a mesma senha que você usa no sistema de Rotas.' : 'Informe sua senha administrativa.');
    }

    if (mode === 'seller') {
      setSellerSigningIn(true);
      try {
        const bridge = await authApi.sellerLogin(data.email, data.password);
        const { data: auth, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: bridge.tokenHash,
          type: 'magiclink',
        });
        if (verifyError || !auth.user) {
          await supabase.auth.signOut();
          return toast.error('As credenciais foram validadas, mas não foi possível abrir a sessão no Mirror. Tente novamente.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role,active,name')
          .eq('id', auth.user.id)
          .maybeSingle();
        if (profileError || !profile || profile.role !== 'seller' || profile.active !== true) {
          await supabase.auth.signOut();
          return toast.error('Este usuário não possui acesso comercial ativo.');
        }

        navigate('/kanban', { replace: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível entrar com as credenciais do Rotas.');
      } finally {
        setSellerSigningIn(false);
      }
      return;
    }

    if (data.password.length < 6) return toast.error('Informe sua senha administrativa.');
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

  const submitting = isSubmitting || sellerSigningIn;

  return <div className="login-shell"><div className="login-theme-toggle"><ThemeToggle /></div><div className="login-visual"><div className="login-visual-content"><div className="brand brand-light"><div className="brand-mark"><ShieldCheck size={19} /></div><div><strong>MirrorDesk</strong><span>auditoria e acompanhamento comercial</span></div></div><div className="visual-copy"><p className="eyebrow">AMBIENTE CORPORATIVO</p><h1>Da conversa à continuidade comercial.</h1><p>Administradores conferem os canais oficiais; vendedores acompanham exclusivamente a jornada dos leads direcionados pelo sistema de Rotas.</p></div><div className="visual-stat"><span className="stat-pulse" /><div><strong>Acessos separados por função</strong><small>WhatsApp e auditoria restritos ao administrador</small></div></div></div><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-grid" /></div><main className="login-card-wrap"><div className="login-card"><div className="mobile-brand brand"><div className="brand-mark"><ShieldCheck size={19} /></div><strong>MirrorDesk</strong></div><div className="login-heading"><span className="login-icon">{mode === 'admin' ? <LockKeyhole size={19} /> : <KeyRound size={19} />}</span><p className="eyebrow">{mode === 'admin' ? 'ACESSO ADMINISTRATIVO' : 'ACESSO COMERCIAL'}</p><h2>Bem-vindo de volta</h2><p>{mode === 'admin' ? 'Entre para acessar o painel de conferência.' : 'Use o mesmo e-mail e senha que você utiliza no sistema de Rotas.'}</p></div><div className="login-role-switch"><button type="button" className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Administrador</button><button type="button" className={mode === 'seller' ? 'active' : ''} onClick={() => setMode('seller')}>Vendedor</button></div><form onSubmit={handleSubmit(onSubmit)} className="login-form"><label>E-mail<input type="email" placeholder={mode === 'admin' ? 'admin@empresa.com.br' : 'vendedor@odontoart.com.br'} autoComplete="email" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label><label>Senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" {...register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{mode === 'seller' && <p className="login-helper">A senha é validada diretamente no sistema de Rotas e não é armazenada no Mirror.</p>}<div className="form-meta"><span />{mode === 'admin' && <button type="button" className="link-button" onClick={() => void recover()}>Esqueci minha senha</button>}</div><Button type="submit" size="lg" disabled={submitting}>{submitting ? 'Autenticando...' : (mode === 'seller' ? 'Entrar no Kanban' : 'Entrar no painel')} {!submitting && <ArrowRight size={17} />}</Button></form><p className="login-footnote"><ShieldCheck size={14} /> {mode === 'admin' ? 'Seus acessos e visualizações são registrados para auditoria.' : 'Você terá acesso apenas aos leads comerciais associados às suas visitas.'}</p></div><footer>© 2026 MirrorDesk · Ambiente corporativo</footer></main></div>;
}
