import { describe, expect, it } from 'vitest';
import themeCss from './theme.css?raw';

function darkToken(name: string) {
  const block = themeCss.match(/html\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1];
  const value = block?.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  if (!value) throw new Error(`Token --${name} não encontrado no tema escuro.`);
  return value;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('dark theme readability', () => {
  it.each([
    ['texto principal no canvas', 'text-primary', 'bg-canvas', 7],
    ['texto principal em superfície', 'text-primary', 'surface', 7],
    ['texto secundário no canvas', 'text-secondary', 'bg-canvas', 7],
    ['texto auxiliar no canvas', 'text-muted', 'bg-canvas', 4.5],
    ['ação azul em superfície', 'accent', 'surface', 4.5],
    ['sucesso', 'success', 'success-soft', 4.5],
    ['aviso', 'warning', 'warning-soft', 4.5],
    ['erro', 'danger', 'danger-soft', 4.5],
  ])('%s mantém contraste adequado', (_label, foreground, background, minimum) => {
    expect(contrast(darkToken(foreground), darkToken(background))).toBeGreaterThanOrEqual(minimum);
  });
});
