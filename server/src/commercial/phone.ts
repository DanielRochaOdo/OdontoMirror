export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;

  let digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

  if (digits.length === 12 && digits.startsWith('55')) {
    const subscriber = digits.slice(4);
    if (subscriber.length === 8 && /^[6789]/.test(subscriber)) {
      return `${digits.slice(0, 4)}9${subscriber}`;
    }
    return digits;
  }

  if (digits.length === 13 && digits.startsWith('55')) return digits;
  return digits.length >= 10 ? digits : null;
}

export function extractPhones(value: string | null | undefined): string[] {
  if (!value) return [];
  const candidates = value.match(/\+?\d[\d\s()./-]{7,}\d/g) ?? [value];
  return [...new Set(candidates.map(normalizePhone).filter((item): item is string => Boolean(item)))];
}
