import { DEFAULT_BACKGROUND, DEFAULT_TRANSFORM } from './defaults';
import type { Background, Content, IconState, Layer, Transform } from './types';

export interface Preset {
  id: string;
  name: string;
  roleColor: string;
  icon: IconState;
}

type LayerSpec = {
  content: Content;
  transform?: Partial<Transform>;
  clip?: boolean;
  blend?: Layer['blend'];
};

function layer(spec: LayerSpec, index: number): Layer {
  return {
    id: `p${index}`,
    name: '',
    hidden: false,
    locked: false,
    content: spec.content,
    transform: { ...DEFAULT_TRANSFORM, ...spec.transform },
    blend: spec.blend ?? 'normal',
    clip: spec.clip ?? true,
  };
}

function preset(
  id: string,
  name: string,
  roleColor: string,
  background: Partial<Background>,
  specs: LayerSpec[],
): Preset {
  return {
    id,
    name,
    roleColor,
    icon: {
      v: 2,
      background: {
        ...structuredClone(DEFAULT_BACKGROUND),
        border: { width: 0, color: '#ffffff' },
        ...background,
      },
      layers: specs.map(layer),
    },
  };
}

const white = '#ffffff';

export const PRESETS: readonly Preset[] = [
  preset(
    'admin',
    'Admin',
    '#e74c3c',
    {
      shape: 'shield',
      fill: { type: 'linear', color1: '#ff5f5f', color2: '#b3121b', angle: 160 },
      border: { width: 0.04, color: white },
      gloss: true,
      shadow: { ...DEFAULT_BACKGROUND.shadow, enabled: true },
    },
    [{ content: { kind: 'symbol', symbol: 'crown', color: white, shadow: false } }],
  ),
  preset(
    'moderator',
    'Moderator',
    '#2ecc71',
    {
      shape: 'circle',
      fill: { type: 'linear', color1: '#2ecc71', color2: '#1f8b4c', angle: 135 },
      border: { width: 0.04, color: white },
    },
    [{ content: { kind: 'symbol', symbol: 'shield', color: white, shadow: false } }],
  ),
  preset(
    'vip',
    'VIP',
    '#f1c40f',
    {
      shape: 'roundedSquare',
      cornerRadius: 0.3,
      fill: { type: 'linear', color1: '#f1c40f', color2: '#e67e22', angle: 160 },
      gloss: true,
    },
    [
      {
        content: {
          kind: 'text',
          text: 'VIP',
          font: 'bangers',
          customFont: null,
          weight: 400,
          color: '#3d2b00',
          letterSpacing: 0.02,
          stroke: null,
          shadow: false,
        },
      },
    ],
  ),
  preset(
    'booster',
    'Server Booster',
    '#f47fff',
    { shape: 'circle', fill: { type: 'radial', color1: '#ff73fa', color2: '#b845c1', angle: 0 } },
    [{ content: { kind: 'symbol', symbol: 'gem', color: white, shadow: true } }],
  ),
  preset(
    'bot',
    'Bot',
    '#3498db',
    {
      shape: 'roundedSquare',
      cornerRadius: 0.25,
      fill: { type: 'linear', color1: '#3498db', color2: '#206694', angle: 135 },
    },
    [{ content: { kind: 'emoji', emoji: '\u{1F916}', shadow: false } }],
  ),
  preset(
    'verified',
    'Verified',
    '#3498db',
    { shape: 'badge', fill: { type: 'solid', color1: '#3498db', color2: '#206694', angle: 0 } },
    [{ content: { kind: 'symbol', symbol: 'check', color: white, shadow: false } }],
  ),
  preset(
    'artist',
    'Artist',
    '#9b59b6',
    { shape: 'circle', fill: { type: 'linear', color1: '#9b59b6', color2: '#e91e63', angle: 45 } },
    [{ content: { kind: 'emoji', emoji: '\u{1F3A8}', shadow: false } }],
  ),
  preset(
    'gamer',
    'Gamer',
    '#1abc9c',
    {
      shape: 'hexagon',
      fill: { type: 'linear', color1: '#1abc9c', color2: '#206694', angle: 135 },
      border: { width: 0.03, color: white },
    },
    [{ content: { kind: 'emoji', emoji: '\u{1F3AE}', shadow: false } }],
  ),
  preset(
    'developer',
    'Developer',
    '#2ecc71',
    {
      shape: 'roundedSquare',
      cornerRadius: 0.2,
      fill: { type: 'solid', color1: '#1e1f22', color2: '#3f4147', angle: 0 },
      border: { width: 0.04, color: '#2ecc71' },
    },
    [{ content: { kind: 'symbol', symbol: 'code', color: '#2ecc71', shadow: false } }],
  ),
  preset(
    'streamer',
    'Streamer',
    '#e91e63',
    { shape: 'circle', fill: { type: 'radial', color1: '#e91e63', color2: '#71368a', angle: 0 } },
    [{ content: { kind: 'symbol', symbol: 'bolt', color: white, shadow: true } }],
  ),
  preset(
    'dj',
    'DJ',
    '#11806a',
    { shape: 'circle', fill: { type: 'linear', color1: '#11806a', color2: '#1abc9c', angle: 90 } },
    [{ content: { kind: 'symbol', symbol: 'note', color: white, shadow: false } }],
  ),
  preset(
    'nightowl',
    'Night Owl',
    '#206694',
    { shape: 'circle', fill: { type: 'linear', color1: '#206694', color2: '#0f2a44', angle: 180 } },
    [{ content: { kind: 'symbol', symbol: 'moon', color: '#f1c40f', shadow: false } }],
  ),

  // Stacked designs, only possible now that an icon can hold several layers.
  preset(
    'champion',
    'Champion',
    '#f1c40f',
    {
      shape: 'circle',
      fill: { type: 'linear', color1: '#f1c40f', color2: '#c27c0e', angle: 160 },
      border: { width: 0.03, color: '#fff4d6' },
      gloss: true,
    },
    [
      {
        content: {
          kind: 'shape',
          shape: 'burst',
          sides: 12,
          innerRatio: 0.72,
          rotation: 0,
          cornerRadius: 0.25,
          fill: { type: 'solid', color1: '#fff4d6', color2: '#fff4d6', angle: 0 },
          border: { width: 0, color: '#000000' },
          shadow: false,
        },
        transform: { scale: 1.28, opacity: 0.35 },
      },
      { content: { kind: 'symbol', symbol: 'trophy', color: '#7a4a00', shadow: false } },
    ],
  ),
  preset(
    'squad',
    'Squad Lead',
    '#e74c3c',
    {
      shape: 'shield',
      fill: { type: 'linear', color1: '#e74c3c', color2: '#992d22', angle: 160 },
      border: { width: 0.035, color: white },
    },
    [
      {
        content: { kind: 'symbol', symbol: 'star', color: '#ffffff', shadow: false },
        transform: { scale: 0.62, y: -0.2, opacity: 0.85 },
      },
      {
        content: {
          kind: 'text',
          text: 'SL',
          font: 'bebas',
          customFont: null,
          weight: 400,
          color: white,
          letterSpacing: 0.04,
          stroke: null,
          shadow: true,
        },
        transform: { scale: 0.8, y: 0.14 },
      },
    ],
  ),
  preset(
    'eclipse',
    'Eclipse',
    '#71368a',
    {
      shape: 'circle',
      fill: { type: 'radial', color1: '#2b1055', color2: '#0f0524', angle: 0 },
    },
    [
      {
        content: {
          kind: 'shape',
          shape: 'circle',
          sides: 6,
          innerRatio: 0.62,
          rotation: 0,
          cornerRadius: 0.25,
          fill: { type: 'linear', color1: '#ffd166', color2: '#ff7a00', angle: 135 },
          border: { width: 0, color: '#000000' },
          shadow: false,
        },
        transform: { scale: 0.78 },
      },
      {
        content: {
          kind: 'shape',
          shape: 'circle',
          sides: 6,
          innerRatio: 0.62,
          rotation: 0,
          cornerRadius: 0.25,
          fill: { type: 'solid', color1: '#0f0524', color2: '#0f0524', angle: 0 },
          border: { width: 0, color: '#000000' },
          shadow: false,
        },
        transform: { scale: 0.66, x: 0.12, y: -0.1 },
      },
    ],
  ),
];
