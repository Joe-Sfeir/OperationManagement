/**
 * Signs drawn on a canvas at start-up: no image files. Text is set in IBM Plex
 * Sans; the texture is redrawn once the font has loaded so the first frame is
 * never left in a fallback face.
 */
import * as THREE from 'three';
import { font } from '../../design/tokens';

export interface SignSpec {
  /** Lines of text, top to bottom. */
  lines: string[];
  /** Board and text colours. */
  bg: string;
  fg: string;
  /** Board size in metres (width, height); the canvas follows the same shape. */
  size: [number, number];
  /** Optional warning triangle or arrow drawn at the left. */
  mark?: 'warning' | 'arrow';
  border?: string;
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: SignSpec) {
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, w, h);
  if (s.border) {
    ctx.strokeStyle = s.border;
    ctx.lineWidth = h * 0.05;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }
  let left = h * 0.18;
  if (s.mark) {
    const m = h * 0.62;
    const cx = h * 0.16 + m / 2;
    const cy = h / 2;
    ctx.fillStyle = s.fg;
    ctx.strokeStyle = s.fg;
    ctx.lineJoin = 'round';
    if (s.mark === 'warning') {
      ctx.lineWidth = h * 0.05;
      ctx.beginPath();
      ctx.moveTo(cx, cy - m * 0.46);
      ctx.lineTo(cx + m * 0.5, cy + m * 0.4);
      ctx.lineTo(cx - m * 0.5, cy + m * 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(cx - h * 0.025, cy - m * 0.16, h * 0.05, m * 0.3);
      ctx.beginPath();
      ctx.arc(cx, cy + m * 0.26, h * 0.032, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = h * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - m * 0.4, cy);
      ctx.lineTo(cx + m * 0.4, cy);
      ctx.moveTo(cx + m * 0.1, cy - m * 0.3);
      ctx.lineTo(cx + m * 0.4, cy);
      ctx.lineTo(cx + m * 0.1, cy + m * 0.3);
      ctx.stroke();
    }
    left = h * 0.16 + m + h * 0.16;
  }
  // Largest type that fits the board.
  ctx.fillStyle = s.fg;
  ctx.textBaseline = 'middle';
  const n = s.lines.length;
  let px = (h * 0.7) / n;
  const fits = () => s.lines.every((t) => ctx.measureText(t).width <= w - left - h * 0.18);
  for (; px > 8; px -= 2) {
    ctx.font = `600 ${px}px ${font.sans}`;
    if (fits()) break;
  }
  const lineH = px * 1.18;
  s.lines.forEach((t, i) => ctx.fillText(t, left, h / 2 + (i - (n - 1) / 2) * lineH));
}

export function signTexture(spec: SignSpec): THREE.CanvasTexture {
  const h = 256;
  const w = Math.round((h * spec.size[0]) / spec.size[1]);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  draw(ctx, w, h, spec);
  // Redraw once Plex is ready.
  void document.fonts?.load(`600 64px "IBM Plex Sans"`).then(() => {
    draw(ctx, w, h, spec);
    tex.needsUpdate = true;
  });
  return tex;
}
