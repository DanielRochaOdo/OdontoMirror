import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [join(dir, entry.name)] : []);
}

describe('read-only provider boundary', () => {
  it('does not expose mutation or presence operations in the server provider layer', () => {
    const source = sourceFiles(join(process.cwd(), 'src')).map((file) => readFileSync(file, 'utf8')).join('\n');
    for (const forbidden of ['sendMessage', 'reply', 'forward', 'deleteMessage', 'editMessage', 'react', 'sendSeen', 'markAsRead', 'typing', 'recording']) expect(source).not.toContain(forbidden);
  });
});
