import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPhones, normalizePhone } from '../commercial/CommercialSyncService.js';

describe('Rotas integration boundary', () => {
  it('contains no database mutation calls in the Rotas client', () => {
    const source = readFileSync(join(process.cwd(), 'src/rotas/readClient.ts'), 'utf8');
    for (const forbidden of ['.insert(', '.upsert(', '.update(', '.delete(', '.rpc(']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('normalizes Brazilian contact numbers consistently', () => {
    expect(normalizePhone('(85) 9 9420-0553')).toBe('5585994200553');
    expect(normalizePhone('+55 85 99420-0553')).toBe('5585994200553');
    expect(extractPhones('Viviane: (85) 9 9420-0553 / (85) 3333-4444')).toEqual([
      '5585994200553',
      '558533334444',
    ]);
  });
});
