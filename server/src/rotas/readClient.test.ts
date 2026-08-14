import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Rotas integration boundary', () => {
  it('contains no database mutation calls in the Rotas data client', () => {
    const source = readFileSync(join(process.cwd(), 'src/rotas/readClient.ts'), 'utf8');
    for (const forbidden of ['.insert(', '.upsert(', '.update(', '.delete(', '.rpc(']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps Rotas data credentials and reads in the backend only', () => {
    const source = readFileSync(join(process.cwd(), 'src/rotas/readClient.ts'), 'utf8');
    expect(source).toContain('ROTAS_SUPABASE_URL');
    expect(source).toContain('ROTAS_SUPABASE_SERVICE_ROLE_KEY');
    expect(source).toContain(".from('profiles')");
    expect(source).toContain(".from('clientes')");
    expect(source).toContain(".from('visits')");
  });

  it('validates seller password with Rotas Auth instead of copying it into Mirror', () => {
    const authSource = readFileSync(join(process.cwd(), 'src/rotas/authClient.ts'), 'utf8');
    expect(authSource).toContain('ROTAS_SUPABASE_ANON_KEY');
    expect(authSource).toContain('.signInWithPassword({');
    expect(authSource).toContain('persistSession: false');
    expect(authSource).not.toContain('supabaseAdmin');
  });

  it('redacts seller passwords from backend request logs', () => {
    const appSource = readFileSync(join(process.cwd(), 'src/app.ts'), 'utf8');
    expect(appSource).toContain("'body.password'");
    expect(appSource).toContain("'req.body.password'");
  });
});
