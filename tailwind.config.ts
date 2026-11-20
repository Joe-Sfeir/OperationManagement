import type { Config } from 'tailwindcss';
import { color, stageColor, font, typeScale, radius } from './src/design/tokens';

const px = (n: number) => `${n}px`;

/**
 * Tailwind theme built from src/design/tokens.ts.
 * colors, fontSize and borderRadius REPLACE Tailwind's defaults on purpose:
 * only the bible's palette and its three type sizes exist, so off-palette
 * colours (purple, blue gradients) and extra sizes fail at build time.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ...color,
      stage: { ...stageColor },
    },
    fontFamily: {
      sans: [font.sans],
      mono: [font.mono],
    },
    fontSize: {
      '12': [px(typeScale[12].size), { lineHeight: px(typeScale[12].lineHeight) }],
      '14': [px(typeScale[14].size), { lineHeight: px(typeScale[14].lineHeight) }],
      '28': [px(typeScale[28].size), { lineHeight: px(typeScale[28].lineHeight) }],
    },
    borderRadius: {
      none: '0',
      control: px(radius.control),
      panel: px(radius.panel),
      full: '9999px',
    },
    extend: {
      transitionTimingFunction: { machine: 'cubic-bezier(0.42, 0, 0.58, 1)' },
      transitionDuration: { 150: '150ms', 200: '200ms', 250: '250ms' },
    },
  },
  plugins: [],
} satisfies Config;
