import type { SymbolId } from '../model/types';
import { heartPath, shieldPath, starPath, type Box } from './shapes';

export interface SymbolPart {
  path: string | (() => Path2D);
  mode: 'fill' | 'stroke';
  /** Stroke width in unit-square coordinates. */
  width?: number;
  fillRule?: CanvasFillRule;
}

export interface SymbolDef {
  label: string;
  parts: readonly SymbolPart[];
}

const TAU = Math.PI * 2;
const UNIT: Box = { x: 0.1, y: 0.1, s: 0.8 };

function fill(path: string | (() => Path2D), fillRule?: CanvasFillRule): SymbolPart {
  return fillRule ? { path, mode: 'fill', fillRule } : { path, mode: 'fill' };
}

function stroke(path: string | (() => Path2D), width: number): SymbolPart {
  return { path, mode: 'stroke', width };
}

function gearPath(): Path2D {
  const p = new Path2D();
  const cx = 0.5;
  const cy = 0.5;
  const outer = 0.48;
  const inner = 0.37;
  const teeth = 8;
  const deg = Math.PI / 180;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const at = (r: number, offsetDeg: number): [number, number] => [
      cx + Math.cos(a + offsetDeg * deg) * r,
      cy + Math.sin(a + offsetDeg * deg) * r,
    ];
    points.push(at(outer, -9), at(outer, 9), at(inner, 13), at(inner, 32));
  }
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  p.moveTo(cx + 0.15, cy);
  p.arc(cx, cy, 0.15, 0, TAU);
  return p;
}

function skullHead(): Path2D {
  const p = new Path2D();
  p.moveTo(0.84, 0.42);
  p.arc(0.5, 0.42, 0.34, 0, TAU);
  p.moveTo(0.46, 0.4);
  p.arc(0.37, 0.4, 0.09, 0, TAU);
  p.moveTo(0.72, 0.4);
  p.arc(0.63, 0.4, 0.09, 0, TAU);
  p.moveTo(0.5, 0.5);
  p.lineTo(0.55, 0.6);
  p.lineTo(0.45, 0.6);
  p.closePath();
  return p;
}

function skullJaw(): Path2D {
  const p = new Path2D();
  const x = 0.32;
  const y = 0.7;
  const w = 0.36;
  const h = 0.24;
  const r = 0.07;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.arcTo(x + w, y, x + w, y + r, r);
  p.lineTo(x + w, y + h - r);
  p.arcTo(x + w, y + h, x + w - r, y + h, r);
  p.lineTo(x + r, y + h);
  p.arcTo(x, y + h, x, y + h - r, r);
  p.lineTo(x, y + r);
  p.arcTo(x, y, x + r, y, r);
  p.closePath();
  return p;
}

function noteHeads(): Path2D {
  const p = new Path2D();
  p.ellipse(0.36, 0.78, 0.13, 0.09, -0.35, 0, TAU);
  p.moveTo(0.83, 0.7);
  p.ellipse(0.7, 0.7, 0.13, 0.09, -0.35, 0, TAU);
  return p;
}

function pawPath(): Path2D {
  const p = new Path2D();
  const toes: Array<[number, number]> = [
    [0.24, 0.42],
    [0.4, 0.26],
    [0.6, 0.26],
    [0.76, 0.42],
  ];
  for (const [x, y] of toes) {
    p.moveTo(x + 0.09, y);
    p.ellipse(x, y, 0.09, 0.12, 0, 0, TAU);
  }
  p.moveTo(0.74, 0.66);
  p.ellipse(0.5, 0.66, 0.24, 0.2, 0, 0, TAU);
  return p;
}

function keyRing(): Path2D {
  const p = new Path2D();
  p.moveTo(0.42, 0.5);
  p.arc(0.24, 0.5, 0.18, 0, TAU);
  p.moveTo(0.32, 0.5);
  p.arc(0.24, 0.5, 0.08, 0, TAU);
  return p;
}

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  crown: {
    label: 'Crown',
    parts: [
      fill('M.08 .78 L.08 .32 L.32 .52 L.5 .2 L.68 .52 L.92 .32 L.92 .78 Z'),
      fill('M.08 .82 H.92 V.92 H.08 Z'),
    ],
  },
  shield: { label: 'Shield', parts: [fill(() => shieldPath({ x: 0.12, y: 0.08, s: 0.76 }))] },
  star: { label: 'Star', parts: [fill(() => starPath({ x: 0.06, y: 0.06, s: 0.88 }))] },
  heart: { label: 'Heart', parts: [fill(() => heartPath(UNIT))] },
  bolt: { label: 'Bolt', parts: [fill('M.58 .05 L.2 .55 L.46 .55 L.38 .95 L.8 .42 L.54 .42 Z')] },
  check: { label: 'Check', parts: [stroke('M.18 .52 L.42 .76 L.84 .28', 0.16)] },
  cross: { label: 'Cross', parts: [stroke('M.25 .25 L.75 .75 M.75 .25 L.25 .75', 0.16)] },
  gear: { label: 'Gear', parts: [fill(gearPath, 'evenodd')] },
  gem: { label: 'Gem', parts: [fill('M.3 .15 L.7 .15 L.92 .4 L.5 .9 L.08 .4 Z')] },
  sword: {
    label: 'Sword',
    parts: [
      fill('M.5 .04 L.6 .16 L.6 .58 L.4 .58 L.4 .16 Z'),
      fill('M.26 .58 H.74 V.68 H.26 Z'),
      fill('M.45 .68 H.55 V.86 H.45 Z'),
      fill(() => {
        const p = new Path2D();
        p.arc(0.5, 0.9, 0.07, 0, TAU);
        return p;
      }),
    ],
  },
  skull: { label: 'Skull', parts: [fill(skullHead, 'evenodd'), fill(skullJaw)] },
  note: {
    label: 'Music note',
    parts: [fill(noteHeads), stroke('M.47 .77 L.47 .22 L.81 .14 L.81 .69', 0.07)],
  },
  code: {
    label: 'Code',
    parts: [stroke('M.3 .28 L.1 .5 L.3 .72 M.7 .28 L.9 .5 L.7 .72 M.58 .18 L.42 .82', 0.1)],
  },
  flame: {
    label: 'Flame',
    parts: [
      fill(
        'M.5 .05 C.5 .05 .82 .35 .82 .6 C.82 .8 .68 .95 .5 .95 C.32 .95 .18 .8 .18 .6 C.18 .48 .28 .38 .32 .3 C.36 .45 .44 .48 .44 .48 C.42 .3 .5 .05 .5 .05 Z',
      ),
    ],
  },
  moon: { label: 'Moon', parts: [fill('M.71 .08 A.42 .42 0 1 0 .71 .92 A.5 .5 0 0 1 .71 .08 Z')] },
  paw: { label: 'Paw', parts: [fill(pawPath)] },
  trophy: {
    label: 'Trophy',
    parts: [
      fill('M.2 .1 H.8 V.42 C.8 .58 .66 .68 .5 .68 C.34 .68 .2 .58 .2 .42 Z'),
      stroke('M.2 .18 C.06 .18 .06 .44 .22 .46 M.8 .18 C.94 .18 .94 .44 .78 .46', 0.06),
      fill('M.44 .68 H.56 V.8 H.44 Z'),
      fill('M.3 .8 H.7 V.9 H.3 Z'),
    ],
  },
  key: {
    label: 'Key',
    parts: [
      fill(keyRing, 'evenodd'),
      fill('M.4 .45 H.92 V.55 H.4 Z'),
      fill('M.72 .55 H.78 V.68 H.72 Z'),
      fill('M.84 .55 H.9 V.7 H.84 Z'),
    ],
  },
};

const pathCache = new Map<string, Path2D>();

export function partPath(part: SymbolPart): Path2D {
  if (typeof part.path !== 'string') return part.path();
  let cached = pathCache.get(part.path);
  if (!cached) {
    cached = new Path2D(part.path);
    pathCache.set(part.path, cached);
  }
  return cached;
}
