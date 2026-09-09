import type { ShapeKind } from '../model/types';

/** Fraction of the canvas left empty around the shape so shadows and glows fit. */
export const SHAPE_INSET = 0.06;

export interface Box {
  x: number;
  y: number;
  s: number;
}

export function shapeBox(size: number): Box {
  const inset = SHAPE_INSET * size;
  return { x: inset, y: inset, s: size - inset * 2 };
}

const TAU = Math.PI * 2;

function polygon(path: Path2D, points: ReadonlyArray<readonly [number, number]>): void {
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.closePath();
}

function roundedSquare(box: Box, radiusFraction: number): Path2D {
  const { x, y, s } = box;
  const r = Math.max(0, Math.min(0.5, radiusFraction)) * s;
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.lineTo(x + s - r, y);
  p.arcTo(x + s, y, x + s, y + r, r);
  p.lineTo(x + s, y + s - r);
  p.arcTo(x + s, y + s, x + s - r, y + s, r);
  p.lineTo(x + r, y + s);
  p.arcTo(x, y + s, x, y + s - r, r);
  p.lineTo(x, y + r);
  p.arcTo(x, y, x + r, y, r);
  p.closePath();
  return p;
}

function squircle(box: Box): Path2D {
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const r = box.s / 2;
  const exponent = 2 / 4;
  const points: Array<[number, number]> = [];
  const steps = 256;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU;
    const c = Math.cos(t);
    const s = Math.sin(t);
    points.push([
      cx + Math.sign(c) * Math.abs(c) ** exponent * r,
      cy + Math.sign(s) * Math.abs(s) ** exponent * r,
    ]);
  }
  const p = new Path2D();
  polygon(p, points);
  return p;
}

function regularPolygon(box: Box, sides: number, startAngle: number): Path2D {
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const r = box.s / 2;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i / sides) * TAU;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const p = new Path2D();
  polygon(p, points);
  return p;
}

export function starPath(box: Box, innerRatio = 0.5): Path2D {
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const outer = box.s / 2;
  const inner = outer * innerRatio;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / 10) * TAU;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const p = new Path2D();
  polygon(p, points);
  return p;
}

export function heartPath(box: Box): Path2D {
  const steps = 120;
  const raw: Array<[number, number]> = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU;
    raw.push([
      16 * Math.sin(t) ** 3,
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
    ]);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of raw) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const scale = box.s / Math.max(maxX - minX, maxY - minY);
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const p = new Path2D();
  polygon(
    p,
    raw.map(([x, y]) => [cx + (x - midX) * scale, cy - (y - midY) * scale]),
  );
  return p;
}

export function shieldPath(box: Box): Path2D {
  const { x, y, s } = box;
  const x1 = x + s;
  const c = x + s / 2;
  const p = new Path2D();
  p.moveTo(x, y);
  p.lineTo(x1, y);
  p.lineTo(x1, y + 0.5 * s);
  p.bezierCurveTo(x1, y + 0.8 * s, c + 0.2 * s, y + 0.95 * s, c, y + s);
  p.bezierCurveTo(c - 0.2 * s, y + 0.95 * s, x, y + 0.8 * s, x, y + 0.5 * s);
  p.closePath();
  return p;
}

/** An N-pointed starburst: the seal look, with any number of spikes. */
function burstPath(box: Box, points: number, innerRatio: number): Path2D {
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const outer = box.s / 2;
  const inner = outer * innerRatio;
  const vertices: Array<[number, number]> = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / (points * 2)) * TAU;
    vertices.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  const p = new Path2D();
  polygon(p, vertices);
  return p;
}

function badgePath(box: Box): Path2D {
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const base = box.s / 2;
  const points: Array<[number, number]> = [];
  const steps = 360;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU;
    const r = base * (0.92 + 0.08 * Math.cos(12 * t));
    points.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  const p = new Path2D();
  polygon(p, points);
  return p;
}

export interface ShapeOptions {
  /** Rounded-square corner radius, as a fraction of the shape size. */
  cornerRadius?: number;
  /** Sides for `polygon`, points for `burst`. */
  sides?: number;
  /** Inner radius ratio for `burst`, 0..1. */
  innerRatio?: number;
  /** Rotates the silhouette itself, in degrees. */
  rotation?: number;
}

function rotatePath(path: Path2D, box: Box, degrees: number): Path2D {
  if (!degrees) return path;
  const cx = box.x + box.s / 2;
  const cy = box.y + box.s / 2;
  const matrix = new DOMMatrix()
    .translateSelf(cx, cy)
    .rotateSelf(degrees)
    .translateSelf(-cx, -cy);
  const rotated = new Path2D();
  rotated.addPath(path, matrix);
  return rotated;
}

/**
 * The outline of a shape inside `box`, or null for the transparent "none"
 * shape. `options` accepts a bare corner radius for backwards compatibility.
 */
export function shapePath(
  kind: ShapeKind,
  box: Box,
  options: number | ShapeOptions = {},
): Path2D | null {
  const opts: ShapeOptions = typeof options === 'number' ? { cornerRadius: options } : options;
  const cornerRadius = opts.cornerRadius ?? 0.25;
  const path = basePath(kind, box, opts, cornerRadius);
  return path && opts.rotation ? rotatePath(path, box, opts.rotation) : path;
}

function basePath(
  kind: ShapeKind,
  box: Box,
  opts: ShapeOptions,
  cornerRadius: number,
): Path2D | null {
  const { x, y, s } = box;
  switch (kind) {
    case 'circle': {
      const p = new Path2D();
      p.arc(x + s / 2, y + s / 2, s / 2, 0, TAU);
      return p;
    }
    case 'square': {
      const p = new Path2D();
      p.rect(x, y, s, s);
      return p;
    }
    case 'roundedSquare':
      return roundedSquare(box, cornerRadius);
    case 'squircle':
      return squircle(box);
    case 'hexagon':
      return regularPolygon(box, 6, -Math.PI / 2);
    case 'diamond': {
      const p = new Path2D();
      polygon(p, [
        [x + s / 2, y],
        [x + s, y + s / 2],
        [x + s / 2, y + s],
        [x, y + s / 2],
      ]);
      return p;
    }
    case 'star':
      return starPath(box);
    case 'polygon':
      return regularPolygon(box, Math.round(Math.min(12, Math.max(3, opts.sides ?? 5))), -Math.PI / 2);
    case 'burst':
      return burstPath(
        box,
        Math.round(Math.min(24, Math.max(3, opts.sides ?? 8))),
        Math.min(0.95, Math.max(0.2, opts.innerRatio ?? 0.62)),
      );
    case 'heart':
      return heartPath(box);
    case 'shield':
      return shieldPath(box);
    case 'badge':
      return badgePath(box);
    case 'none':
      return null;
  }
}
