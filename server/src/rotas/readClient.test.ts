import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Rotas integration boundary', () => {
  it('contains no database mutation calls in the Rotas client', () => {
    const source = readFileSync(join(process.cwd(), 'src/rotas/readClient.ts'), 'utf8');
    for (const forbidden of ['.insert(', '.upsert(', '.update(', '.delete(', '.rpc(']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps Rotas credentials and reads in the backend only', () => {
    const source = readFileSync(join(process.cwd(), 'src/rotas/readClient.ts'), 'utf8');
    expect(source).toContain('ROTAS_SUPABASE_URL');
    expect(source).toContain('ROTAS_SUPABASE_SERVICE_ROLE_KEY');
    expect(source).toContain(".from('profiles')");
    expect(source).toContain(".from('clientes')");
    expect(source).toContain(".from('visits')");
  });
});
