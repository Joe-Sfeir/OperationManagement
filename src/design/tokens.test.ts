import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { palette, neutral, easeInOutCubic, motion } from './tokens';

/** Parse the Palette table in docs/STYLE_BIBLE.md so tokens can't drift from the bible. */
function biblePalette(): Record<string, string> {
  const md = readFileSync(new URL('../../docs/STYLE_BIBLE.md', import.meta.url), 'utf8');
  const out: Record<string, string> = {};
  for (const m of md.matchAll(/^\|\s*([A-Za-z ]+?)\s*\|\s*(#[0-9A-Fa-f]{6})\s*\|/gm)) {
    out[m[1]!] = m[2]!.toUpperCase();
  }
  return out;
}

const nameToKey: Record<string, keyof typeof palette> = {
  Canvas: 'canvas',
  Panel: 'panel',
  'Machine cream': 'machineCream',
  'NTG blue': 'ntgBlue',
  'Mould black': 'mouldBlack',
  'Floor epoxy': 'floorEpoxy',
  'Safety yellow': 'safetyYellow',
  'Heat amber': 'heatAmber',
  'Cool teal': 'coolTeal',
  'Alert red': 'alertRed',
};

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe('design tokens', () => {
  it('match every palette row in STYLE_BIBLE.md', () => {
    const bible = biblePalette();
    expect(Object.keys(bible).sort()).toEqual(Object.keys(nameToKey).sort());
    for (const [name, hex] of Object.entries(bible)) {
      expect(palette[nameToKey[name]!].toUpperCase(), name).toBe(hex);
    }
  });

  it('keep interface text at WCAG AA on panels and canvas', () => {
    for (const t of [neutral.text, neutral.textMuted, neutral.textFaint]) {
      expect(contrast(t, palette.panel)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t, palette.canvas)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('use a machine ease that is monotonic and never overshoots', () => {
    let prev = 0;
    for (let i = 0; i <= 1000; i++) {
      const v = easeInOutCubic(i / 1000);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(v).toBeLessThanOrEqual(1);
      prev = v;
    }
    const [x1, y1, x2, y2] = motion.easeInOut;
    for (const v of [x1, y1, x2, y2]) expect(v >= 0 && v <= 1).toBe(true);
  });
});
