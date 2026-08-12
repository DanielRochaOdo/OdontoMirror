import { describe, expect, it } from 'vitest';
import { formatFileSize, titleFromAction } from './utils';

describe('formatadores do painel', () => {
  it('formata tamanhos de arquivo em KB e MB', () => {
    expect(formatFileSize(0)).toBe('0 KB');
    expect(formatFileSize(2_000)).toBe('2 KB');
    expect(formatFileSize(2_500_000)).toBe('2.5 MB');
  });

  it('transforma ações de auditoria em títulos legíveis', () => {
    expect(titleFromAction('VIEW_CONVERSATION')).toBe('View Conversation');
    expect(titleFromAction('SYNC_WHATSAPP')).toBe('Sync Whatsapp');
  });
});
