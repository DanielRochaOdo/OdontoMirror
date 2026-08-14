import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export type RotasVendor = {
  userId: string;
  name: string;
  email: string | null;
  active: boolean;
  supervisorUserId: string | null;
};

export type RotasCompany = {
  id: string;
  code: string | null;
  name: string;
  tradeName: string | null;
  contactName: string | null;
  contactRaw: string | null;
  status: string | null;
  category: string | null;
  groupName: string | null;
  city: string | null;
  district: string | null;
  uf: string | null;
  lastVisitAt: string | null;
};

export type RotasVisit = {
  id: string;
  companyId: string;
  visitDate: string;
  routeId: string | null;
  vendorUserId: string | null;
  vendorName: string | null;
  completedAt: string | null;
};

type RotasProfileRow = {
  user_id: string | null;
  display_name: string | null;
  nome: string | null;
  role: string | null;
  supervisor_id: string | null;
  is_inactive: boolean | null;
};

type RotasCompanyRow = {
  id: string;
  codigo: string | null;
  empresa: string | null;
  nome_fantasia: string | null;
  pessoa: string | null;
  contato: string | null;
  situacao: string | null;
  categoria: string | null;
  grupo: string | null;
  cidade: string | null;
  bairro: string | null;
  uf: string | null;
  data_da_ultima_visita: string | null;
};

type RotasVisitRow = {
  id: string;
  cliente_id: string | null;
  visit_date: string;
  route_id: string | null;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  completed_at: string | null;
};

const rotasClient = env.ROTAS_SUPABASE_URL && env.ROTAS_SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.ROTAS_SUPABASE_URL, env.ROTAS_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function requireRotasClient() {
  if (!rotasClient) {
    throw new Error('Integração com o Rotas não configurada no servidor do Mirror.');
  }
  return rotasClient;
}

export function isRotasConfigured() {
  return Boolean(rotasClient);
}

export async function fetchRotasVendors(): Promise<RotasVendor[]> {
  const client = requireRotasClient();
  const { data, error } = await client
    .from('profiles')
    .select('user_id,display_name,nome,role,supervisor_id,is_inactive')
    .eq('role', 'VENDEDOR');

  if (error) throw new Error(`Rotas/profiles: ${error.message}`);

  const rows = (data ?? []) as RotasProfileRow[];
  const result: RotasVendor[] = [];
  for (const row of rows) {
    if (!row.user_id) continue;
    const { data: authData, error: authError } = await client.auth.admin.getUserById(row.user_id);
    if (authError && !authError.message.toLowerCase().includes('not found')) {
      throw new Error(`Rotas/auth ${row.user_id}: ${authError.message}`);
    }
    result.push({
      userId: row.user_id,
      name: row.display_name?.trim() || row.nome?.trim() || authData?.user?.email || 'Vendedor',
      email: authData?.user?.email ?? null,
      active: row.is_inactive !== true,
      supervisorUserId: row.supervisor_id,
    });
  }
  return result;
}

export async function fetchRotasCompanies(): Promise<RotasCompany[]> {
  const client = requireRotasClient();
  const pageSize = 1000;
  const result: RotasCompany[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('clientes')
      .select('id,codigo,empresa,nome_fantasia,pessoa,contato,situacao,categoria,grupo,cidade,bairro,uf,data_da_ultima_visita')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Rotas/clientes: ${error.message}`);
    const rows = (data ?? []) as RotasCompanyRow[];
    for (const row of rows) {
      result.push({
        id: row.id,
        code: row.codigo,
        name: row.empresa?.trim() || row.nome_fantasia?.trim() || row.codigo || row.id,
        tradeName: row.nome_fantasia,
        contactName: row.pessoa,
        contactRaw: row.contato,
        status: row.situacao,
        category: row.categoria,
        groupName: row.grupo,
        city: row.cidade,
        district: row.bairro,
        uf: row.uf,
        lastVisitAt: row.data_da_ultima_visita,
      });
    }
    if (rows.length < pageSize) break;
  }

  return result;
}

export async function fetchRotasVisits(): Promise<RotasVisit[]> {
  const client = requireRotasClient();
  const pageSize = 1000;
  const result: RotasVisit[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('visits')
      .select('id,cliente_id,visit_date,route_id,assigned_to_user_id,assigned_to_name,completed_at')
      .not('cliente_id', 'is', null)
      .order('visit_date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Rotas/visits: ${error.message}`);
    const rows = (data ?? []) as RotasVisitRow[];
    for (const row of rows) {
      if (!row.cliente_id) continue;
      result.push({
        id: row.id,
        companyId: row.cliente_id,
        visitDate: row.visit_date,
        routeId: row.route_id,
        vendorUserId: row.assigned_to_user_id,
        vendorName: row.assigned_to_name,
        completedAt: row.completed_at,
      });
    }
    if (rows.length < pageSize) break;
  }

  return result;
}
