import { describe, expect, it } from 'vitest';
import { extractPhones, normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('keeps a current Brazilian mobile with ninth digit', () => {
    expect(normalizePhone('85 9 8766-1518')).toBe('5585987661518');
  });

  it('canonicalizes the historical 8-digit WhatsApp mobile form', () => {
    expect(normalizePhone('558587661518')).toBe('5585987661518');
  });

  it('does not add a ninth digit to a fixed line', () => {
    expect(normalizePhone('85 3234-1234')).toBe('558532341234');
  });

  it('extracts and deduplicates equivalent mobile formats', () => {
    expect(extractPhones('85 98766-1518 / 85 8766-1518')).toEqual(['5585987661518']);
  });
});
