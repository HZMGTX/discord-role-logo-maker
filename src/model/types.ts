export const SHAPES = [
  'circle',
  'roundedSquare',
  'square',
  'squircle',
  'hexagon',
  'shield',
  'diamond',
  'star',
  'heart',
  'badge',
  'polygon',
  'burst',
  'none',
] as const;
export type ShapeKind = (typeof SHAPES)[number];

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  circle: 'Circle',
  roundedSquare: 'Rounded',
  square: 'Square',
  squircle: 'Squircle',
  hexagon: 'Hexagon',
  shield: 'Shield',
  diamond: 'Diamond',
  star: 'Star',
  heart: 'Heart',
  badge: 'Badge',
  polygon: 'Polygon',
  burst: 'Burst',
  none: 'None',
};

export const FILL_TYPES = ['solid', 'linear', 'radial'] as const;
export type FillType = (typeof FILL_TYPES)[number];

export interface Fill {
  type: FillType;
  color1: string;
  color2: string;
  /** Degrees, CSS convention: 0 = bottom to top, 90 = left to right. */
  angle: number;
}

export interface Border {
  /** Fraction of the icon size (0 disables the border). */
  width: number;
  color: string;
}

export interface Shadow {
  enabled: boolean;
  /** Fraction of the icon size. */
  blur: number;
  opacity: number;
  /** Offsets as fractions of the icon size. */
  dx: number;
  dy: number;
  color: string;
}

export interface Transform {
  scale: number;
  /** Offsets as fractions of the shape box (-0.5..0.5). */
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
}

export const FONTS = [
  { id: 'inter', family: 'Inter', label: 'Inter', weights: [400, 700, 900] },
  { id: 'rubik', family: 'Rubik', label: 'Rubik', weights: [400, 700, 900] },
  { id: 'bangers', family: 'Bangers', label: 'Bangers', weights: [400] },
  { id: 'luckiest', family: 'Luckiest Guy', label: 'Luckiest Guy', weights: [400] },
  { id: 'pressstart', family: 'Press Start 2P', label: 'Press Start 2P', weights: [400] },
  { id: 'pacifico', family: 'Pacifico', label: 'Pacifico', weights: [400] },
  { id: 'blackops', family: 'Black Ops One', label: 'Black Ops One', weights: [400] },
  { id: 'bebas', family: 'Bebas Neue', label: 'Bebas Neue', weights: [400] },
  { id: 'lobster', family: 'Lobster', label: 'Lobster', weights: [400] },
] as const;
export type FontId = (typeof FONTS)[number]['id'];
export type FontWeight = 400 | 700 | 900;
export const FONT_WEIGHTS: readonly FontWeight[] = [400, 700, 900];

/** Font family names are put into a CSS font shorthand and a URL, so keep them plain. */
export const FONT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 '-]{0,39}$/;

export function isValidFontName(name: string): boolean {
  return FONT_NAME_PATTERN.test(name.trim());
}

export function fontById(id: FontId): (typeof FONTS)[number] {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export const SYMBOL_IDS = [
  'crown',
  'shield',
  'star',
  'heart',
  'bolt',
  'check',
  'cross',
  'gear',
  'gem',
  'sword',
  'skull',
  'note',
  'code',
  'flame',
  'moon',
  'paw',
  'trophy',
  'key',
] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];

export const IMAGE_FITS = ['cover', 'contain'] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

export type Content =
  | { kind: 'emoji'; emoji: string; shadow: boolean }
  | {
      kind: 'text';
      text: string;
      font: FontId;
      /** Any Google Font family name, loaded on demand; overrides `font` when set. */
      customFont: string | null;
      weight: FontWeight;
      color: string;
      /** Fraction of the font size. */
      letterSpacing: number;
      stroke: { width: number; color: string } | null;
      shadow: boolean;
    }
  | { kind: 'symbol'; symbol: SymbolId; color: string; shadow: boolean }
  | { kind: 'image'; src: string | null; fit: ImageFit }
  | {
      kind: 'shape';
      shape: ShapeKind;
      sides: number;
      innerRatio: number;
      rotation: number;
      cornerRadius: number;
      fill: Fill;
      border: Border;
      shadow: boolean;
    }
  | { kind: 'none' };

export type ContentKind = Content['kind'];
export const CONTENT_KINDS: readonly ContentKind[] = [
  'emoji',
  'text',
  'symbol',
  'shape',
  'image',
  'none',
];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  emoji: 'Emoji',
  text: 'Text',
  symbol: 'Symbol',
  shape: 'Shape',
  image: 'Image',
  none: 'Empty',
};

/** Canvas composite operations, exposed as per-layer blend modes. */
export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export function blendToComposite(mode: BlendMode): GlobalCompositeOperation {
  return mode === 'normal' ? 'source-over' : (mode as GlobalCompositeOperation);
}

/** One item in the stack. An icon can hold as many as the user wants. */
export interface Layer {
  id: string;
  /** User-facing name; empty means "derive it from the content". */
  name: string;
  hidden: boolean;
  locked: boolean;
  content: Content;
  transform: Transform;
  blend: BlendMode;
  /** Clip this layer to the background silhouette. */
  clip: boolean;
}

/** The plate every role icon sits on. It also defines the clipping silhouette. */
export interface Background {
  shape: ShapeKind;
  /** Corner radius for the rounded square, as a fraction of the shape size (0..0.5). */
  cornerRadius: number;
  /** Sides for `polygon`, points for `burst`. */
  sides: number;
  /** Spike depth for `burst`, 0..1. */
  innerRatio: number;
  /** Rotation of the silhouette itself, in degrees. */
  rotation: number;
  fill: Fill;
  border: Border;
  shadow: Shadow;
  gloss: boolean;
}

export interface IconState {
  v: 2;
  background: Background;
  /** Bottom to top. Empty means just the background plate. */
  layers: Layer[];
}

export const MAX_LAYERS = 24;

export interface PreviewSettings {
  username: string;
  roleName: string;
  roleColor: string;
  message: string;
}

/** Discord's default role color palette. */
export const ROLE_COLORS = [
  '#1abc9c',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#e91e63',
  '#f1c40f',
  '#e67e22',
  '#e74c3c',
  '#95a5a6',
  '#607d8b',
  '#11806a',
  '#1f8b4c',
  '#206694',
  '#71368a',
  '#ad1457',
  '#c27c0e',
  '#a84300',
  '#992d22',
  '#979c9f',
  '#546e7a',
] as const;

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const RANGES = {
  cornerRadius: { min: 0, max: 0.5, step: 0.01 },
  fillAngle: { min: 0, max: 360, step: 1 },
  borderWidth: { min: 0, max: 0.12, step: 0.005 },
  shadowBlur: { min: 0, max: 0.08, step: 0.005 },
  shadowOpacity: { min: 0, max: 1, step: 0.05 },
  shadowOffset: { min: -0.06, max: 0.06, step: 0.005 },
  scale: { min: 0.2, max: 1.5, step: 0.01 },
  offset: { min: -0.5, max: 0.5, step: 0.01 },
  rotation: { min: -180, max: 180, step: 1 },
  opacity: { min: 0, max: 1, step: 0.01 },
  letterSpacing: { min: -0.1, max: 0.3, step: 0.01 },
  strokeWidth: { min: 0, max: 0.3, step: 0.01 },
  sides: { min: 3, max: 24, step: 1 },
  layerStrokeWidth: { min: 0, max: 0.3, step: 0.01 },
  innerRatio: { min: 0.2, max: 0.95, step: 0.01 },
  shapeRotation: { min: -180, max: 180, step: 1 },
} as const satisfies Record<string, Range>;

export const EXPORT_SIZES = [64, 128, 256, 512] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];
/** Discord's upload limit for role icons. */
export const DISCORD_MAX_BYTES = 256 * 1024;
