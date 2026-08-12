import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from './admin.js';

export async function requireAdmin(request: FastifyRequest, response: FastifyReply) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    response.code(401).send({ error: 'unauthorized', message: 'Autenticação administrativa obrigatória.' });
    return null;
  }
  const token = authorization.slice('Bearer '.length);
  const { data: auth, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !auth.user) {
    response.code(401).send({ error: 'invalid_session', message: 'Sessão inválida ou expirada.' });
    return null;
  }
  const { data: profile } = await supabaseAdmin.from('profiles').select('id,role,active').eq('id', auth.user.id).maybeSingle();
  if (!profile || profile.role !== 'admin' || profile.active !== true) {
    response.code(403).send({ error: 'forbidden', message: 'Usuário sem permissão administrativa ativa.' });
    return null;
  }
  return auth.user;
}
