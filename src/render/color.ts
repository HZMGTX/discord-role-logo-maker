const HEX = /^#([0-9a-f]{6})$/i;

export function isValidHex(value: string): boolean {
  return HEX.test(value);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = HEX.exec(hex);
  if (!match || !match[1]) return { r: 0, g: 0, b: 0 };
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, '0')}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
}

/** Relative luminance (0..1) for contrast decisions. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', amount);
}

/** Euclidean distance in RGB space, for "closest palette color" lookups. */
export function colorDistance(a: string, b: string): number {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return Math.hypot(ca.r - cb.r, ca.g - cb.g, ca.b - cb.b);
}
