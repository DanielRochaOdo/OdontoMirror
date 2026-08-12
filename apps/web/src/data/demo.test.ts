import { describe, expect, it } from 'vitest';
import { conversations } from './demo';

describe('conversation isolation', () => {
  it('returns only conversations belonging to the selected account', () => {
    const accountA = conversations.filter((item) => item.whatsappAccountId === 'sac');
    const accountB = conversations.filter((item) => item.whatsappAccountId === 'financeiro');
    expect(accountA).toHaveLength(5);
    expect(accountB).toHaveLength(5);
    expect(accountA.every((item) => item.whatsappAccountId === 'sac')).toBe(true);
    expect(accountB.every((item) => item.whatsappAccountId === 'financeiro')).toBe(true);
    expect(accountA.some((item) => item.whatsappAccountId === 'financeiro')).toBe(false);
  });
});
