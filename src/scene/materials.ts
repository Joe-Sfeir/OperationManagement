/**
 * Scene materials. Colours come from the style bible palette (tokens.ts) or,
 * for objects the bible describes "as photographed" (hoist block, tank,
 * console), from the site photo. Surface grain is drawn procedurally on a
 * canvas at start-up: no image files, no downloaded assets.
 */
import * as THREE from 'three';
import { palette } from '../design/tokens';

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

// Deterministic pseudo-random for textures, so every load looks the same.
function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Fine grey grain around mid-grey, used as a roughness map only. Do NOT use it as a bump map:
 * three's bump shading can return NaN on some pixels, and the bloom pass then blacks out the frame.
 */
function grain(seed: number, lo = 150, hi = 230, size = 256, repeat = 2) {
  return canvasTexture(
    size,
    (ctx, s) => {
      const r = lcg(seed);
      const img = ctx.createImageData(s, s);
      for (let i = 0; i < s * s; i++) {
        const v = lo + (hi - lo) * (0.5 * r() + 0.5 * r());
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    },
    repeat,
  );
}

/** Long streaks: brushed steel. */
function brushed(seed: number) {
  return canvasTexture(256, (ctx, s) => {
    const r = lcg(seed);
    ctx.fillStyle = 'rgb(150,150,150)';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = 110 + r() * 110;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.lineWidth = 0.5 + r();
      const y = r() * s;
      const x = r() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 40 + r() * 120, y);
      ctx.stroke();
    }
  });
}

/** Epoxy floor: broad soft mottling plus fine grain. */
function mottled(seed: number) {
  return canvasTexture(
    512,
    (ctx, s) => {
      const r = lcg(seed);
      ctx.fillStyle = 'rgb(170,170,170)';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) {
        const v = 120 + r() * 110;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `rgba(${v},${v},${v},0.28)`);
        g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        ctx.save();
        ctx.translate(r() * s, r() * s);
        ctx.scale(20 + r() * 70, 14 + r() * 50);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
    3,
  );
}

function std(color: string, roughness: number, metalness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function build() {
  const g1 = grain(11);
  const g2 = grain(29, 120, 240, 256, 4);
  const br = brushed(7);
  const mot = mottled(3);
  return {
    // Matte painted steel (cabinets, platforms, hub)
    cream: std(palette.machineCream, 0.72, 0.08, { roughnessMap: g1 }),
    creamDark: std('#B9AE96', 0.78, 0.06, { roughnessMap: g1 }),
    blue: std(palette.ntgBlue, 0.6, 0.15, { roughnessMap: g1 }),
    blueDark: std('#234F8F', 0.65, 0.15, { roughnessMap: g1 }),
    // Brushed steel (arms, frames)
    steel: std('#A7AEB3', 0.38, 0.85, { roughnessMap: br }),
    steelDark: std('#5A6268', 0.5, 0.7, { roughnessMap: br }),
    galvanised: std('#8E979D', 0.55, 0.6, { roughnessMap: g2 }),
    // Blackened steel with a faint sheen (moulds)
    mould: std(palette.mouldBlack, 0.42, 0.55, { roughnessMap: g2 }),
    mouldTrim: std('#2E3033', 0.35, 0.7),
    // Floor
    epoxy: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(palette.floorEpoxy).multiplyScalar(0.62), roughness: 0.86, metalness: 0, roughnessMap: mot, clearcoat: 0.05, clearcoatRoughness: 0.9 }),
    plinth: std('#191D20', 0.9, 0),
    yellow: std(palette.safetyYellow, 0.7, 0),
    red: std(palette.alertRed, 0.7, 0),
    yellowInner: std('#C9A93A', 0.8, 0.05, { roughnessMap: g1 }),
    // Oven lining: dark, scorched; glows with temperature (emissive set per frame)
    ovenLining: std('#3A2A22', 0.9, 0.1, { emissive: palette.heatAmber, emissiveIntensity: 0 }),
    section: std('#22272B', 0.95, 0),
    // Polyethylene (tanks), soft satin
    tank: std('#A9B0B2', 0.55, 0),
    tankTop: std('#2A2C2F', 0.5, 0),
    tankOther: std('#7C8589', 0.6, 0),
    powder: std('#ECEBE6', 0.95, 0),
    hose: std('#D9D8D2', 0.7, 0),
    rubber: std('#17191B', 0.85, 0),
    hoist: std('#B8592B', 0.6, 0.2),
    chain: std('#70777C', 0.45, 0.8),
    console: std('#8D9499', 0.6, 0.3, { roughnessMap: g1 }),
    screen: std('#101416', 0.3, 0.1, { emissive: '#D0534A', emissiveIntensity: 0.0 }),
    lampGreen: std('#1F3A28', 0.4, 0, { emissive: '#3FAE6A', emissiveIntensity: 0 }),
    lampAmber: std('#3A2C14', 0.4, 0, { emissive: palette.heatAmber, emissiveIntensity: 0 }),
    cloth: std('#55606B', 0.9, 0),
    clothAlt: std('#6C7A52', 0.9, 0),
    skin: std('#B9A590', 0.8, 0),
    sack: std('#E4E2DA', 0.9, 0),
    sackPrint: std('#B4453D', 0.9, 0),
    wood: std('#8A6E4B', 0.85, 0),
    forklift: std(palette.safetyYellow, 0.55, 0.2),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9FB3BD', roughness: 0.15, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.5 }),
  };
}

let cache: ReturnType<typeof build> | null = null;
/** Shared materials (built once, in the browser). */
export function mats() {
  return (cache ??= build());
}
export type Mats = ReturnType<typeof build>;
