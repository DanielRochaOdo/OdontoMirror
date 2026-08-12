import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';

const schema = z.object({ email: z.string().email('Informe um e-mail válido'), password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres') });
type LoginData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate(); const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginData>({ resolver: zodResolver(schema), defaultValues: { email: 'admin@mirrordesk.com.br', password: 'admin123' } });
  const onSubmit = async (data: LoginData) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (error) return;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    navigate('/whatsapps');
  };
  return <div className="login-shell"><div className="login-visual"><div className="login-visual-content"><div className="brand brand-light"><div className="brand-mark"><ShieldCheck size={19} /></div><div><strong>MirrorDesk</strong><span>auditoria corporativa</span></div></div><div className="visual-copy"><p className="eyebrow">PAINEL DE CONFERÊNCIA</p><h1>Clareza para cada conversa corporativa.</h1><p>Um espaço seguro para consultar o histórico dos seus números oficiais com rastreabilidade e controle.</p></div><div className="visual-stat"><span className="stat-pulse" /><div><strong>Ambiente protegido</strong><small>Somente leitura · acesso administrativo</small></div></div></div><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="visual-grid" /></div><main className="login-card-wrap"><div className="login-card"><div className="mobile-brand brand"><div className="brand-mark"><ShieldCheck size={19} /></div><strong>MirrorDesk</strong></div><div className="login-heading"><span className="login-icon"><LockKeyhole size={19} /></span><p className="eyebrow">ACESSO ADMINISTRATIVO</p><h2>Bem-vindo de volta</h2><p>Entre para acessar o painel de conferência.</p></div><form onSubmit={handleSubmit(onSubmit)} className="login-form"><label>E-mail<input type="email" placeholder="admin@empresa.com.br" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label><label>Senha<div className="password-field"><input type={showPassword ? 'text' : 'password'} {...register('password')} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label><div className="form-meta"><label className="checkbox-label"><input type="checkbox" defaultChecked /> <span>Manter conectado</span></label><a href="#recovery">Esqueci minha senha</a></div><Button type="submit" size="lg" disabled={isSubmitting}> {isSubmitting ? 'Autenticando...' : 'Entrar no painel'} {!isSubmitting && <ArrowRight size={17} />} </Button></form><p className="login-footnote"><ShieldCheck size={14} /> Seus acessos e visualizações são registrados para auditoria.</p></div><footer>© 2026 MirrorDesk · Política de segurança</footer></main></div>;
}
