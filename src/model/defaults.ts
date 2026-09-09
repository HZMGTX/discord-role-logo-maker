import type {
  Background,
  Content,
  ContentKind,
  Fill,
  IconState,
  Layer,
  PreviewSettings,
  Transform,
} from './types';
import { NO_EFFECTS } from './types';

export const DEFAULT_TRANSFORM: Transform = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  flipX: false,
  flipY: false,
};

/**
 * Builds a fill, supplying the gradient extras that a design saved by an
 * earlier build would not have carried. Everything that writes a fill goes
 * through here so the defaults live in one place.
 */
export function fillOf(spec: Partial<Fill> & Pick<Fill, 'type' | 'color1' | 'color2'>): Fill {
  return {
    type: spec.type,
    color1: spec.color1,
    color2: spec.color2,
    angle: spec.angle ?? 135,
    stops: (spec.stops ?? []).map((stop) => ({ ...stop })),
    cx: spec.cx ?? 0,
    cy: spec.cy ?? 0,
    radius: spec.radius ?? 0.55,
  };
}

/** The fill a new shape layer starts with. */
export const DEFAULT_SHAPE_FILL: Fill = fillOf({
  type: 'solid',
  color1: '#ffffff',
  color2: '#ffffff',
  angle: 135,
});

export const DEFAULT_BACKGROUND: Background = {
  shape: 'circle',
  cornerRadius: 0.25,
  sides: 6,
  innerRatio: 0.62,
  rotation: 0,
  fill: fillOf({ type: 'linear', color1: '#3498db', color2: '#206694', angle: 135 }),
  border: { width: 0.04, color: '#ffffff' },
  shadow: { enabled: false, blur: 0.04, opacity: 0.35, dx: 0, dy: 0.02, color: '#000000' },
  gloss: false,
};

let layerSeq = 0;

/** A unique id for a new layer. Ids only need to be unique within one design. */
export function nextLayerId(): string {
  layerSeq += 1;
  return `l${layerSeq}`;
}

export function makeLayer(content: Content, overrides: Partial<Layer> = {}): Layer {
  return {
    id: nextLayerId(),
    name: '',
    hidden: false,
    locked: false,
    content,
    transform: { ...DEFAULT_TRANSFORM },
    blend: 'normal',
    clip: true,
    clipTo: null,
    effects: structuredClone(NO_EFFECTS),
    ...overrides,
  };
}

export const DEFAULT_ICON: IconState = {
  v: 2,
  background: structuredClone(DEFAULT_BACKGROUND),
  layers: [
    {
      id: 'l0',
      name: '',
      hidden: false,
      locked: false,
      content: { kind: 'emoji', emoji: '\u{1F451}', shadow: false },
      transform: { ...DEFAULT_TRANSFORM },
      blend: 'normal',
      clip: true,
      clipTo: null,
      effects: structuredClone(NO_EFFECTS),
    },
  ],
};

export const DEFAULT_PREVIEW: PreviewSettings = {
  username: 'Ayla',
  roleName: 'Moderator',
  roleColor: '#1abc9c',
  message: 'Welcome to the server! Read #rules and have fun',
};

/** A fresh content object for a kind, carrying over colors from the previous content where it makes sense. */
export function defaultContent(kind: ContentKind, prev?: Content): Content {
  const prevColor =
    prev && (prev.kind === 'text' || prev.kind === 'symbol') ? prev.color : '#ffffff';
  const prevShadow = prev && 'shadow' in prev ? prev.shadow : false;
  switch (kind) {
    case 'emoji':
      return { kind: 'emoji', emoji: '\u{1F451}', shadow: prevShadow };
    case 'text':
      return {
        kind: 'text',
        text: 'A',
        font: 'inter',
        customFont: null,
        weight: 900,
        color: prevColor,
        letterSpacing: 0,
        stroke: null,
        shadow: prevShadow,
      };
    case 'symbol':
      return { kind: 'symbol', symbol: 'crown', color: prevColor, shadow: prevShadow };
    case 'shape':
      return {
        kind: 'shape',
        shape: 'circle',
        sides: 6,
        innerRatio: 0.62,
        rotation: 0,
        cornerRadius: 0.25,
        fill: structuredClone(DEFAULT_SHAPE_FILL),
        border: { width: 0, color: '#000000' },
        shadow: prevShadow,
      };
    case 'image':
      return { kind: 'image', src: null, fit: 'cover' };
    case 'none':
      return { kind: 'none' };
  }
}

export function cloneIcon(state: IconState): IconState {
  return structuredClone(state);
}

/** The label shown for a layer in the list when it has no custom name. */
export function layerLabel(layer: Layer): string {
  if (layer.name.trim()) return layer.name.trim();
  const c = layer.content;
  switch (c.kind) {
    case 'emoji':
      return c.emoji;
    case 'text':
      return c.text.trim() ? `“${c.text.trim()}”` : 'Text';
    case 'symbol':
      return c.symbol.charAt(0).toUpperCase() + c.symbol.slice(1);
    case 'shape':
      return c.shape.charAt(0).toUpperCase() + c.shape.slice(1);
    case 'image':
      return c.src ? 'Image' : 'Empty image';
    case 'none':
      return 'Empty';
  }
}
