import { ICON_FRIENDLY_EMOJI } from '../emoji/catalog';
import { mix } from '../render/color';
import { DEFAULT_BACKGROUND, fillOf, makeLayer } from './defaults';
import { FILL_TYPES, SHAPES, SYMBOL_IDS, type IconState } from './types';

const COLOR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['#ff5f5f', '#b3121b'],
  ['#2ecc71', '#1f8b4c'],
  ['#3498db', '#206694'],
  ['#9b59b6', '#71368a'],
  ['#e91e63', '#ad1457'],
  ['#f1c40f', '#e67e22'],
  ['#1abc9c', '#11806a'],
  ['#e67e22', '#a84300'],
  ['#95a5a6', '#546e7a'],
  ['#ff73fa', '#b845c1'],
  ['#00d4ff', '#0066ff'],
  ['#2b2d31', '#5c5e66'],
];

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('pick() called with an empty list');
  return item;
}

export function randomizeIcon(): IconState {
  const [color1, color2] = pick(COLOR_PAIRS);
  const shape = pick(SHAPES.filter((s) => s !== 'none'));
  const content =
    Math.random() < 0.6
      ? ({ kind: 'emoji', emoji: pick(ICON_FRIENDLY_EMOJI), shadow: false } as const)
      : ({
          kind: 'symbol',
          symbol: pick(SYMBOL_IDS),
          color: '#ffffff',
          shadow: Math.random() < 0.4,
        } as const);
  return {
    v: 2,
    background: {
      ...structuredClone(DEFAULT_BACKGROUND),
      shape,
      cornerRadius: 0.18 + Math.random() * 0.22,
      sides: 3 + Math.floor(Math.random() * 9),
      innerRatio: 0.45 + Math.random() * 0.3,
      rotation: 0,
      fill: (() => {
        const type = pick(FILL_TYPES);
        // A conic sweep between two colors wraps with a hard seam at the start
        // angle, so give it a middle color and let it read as a real sweep.
        const stops =
          type === 'conic' ? [{ offset: 0.5, color: mix(color1, color2, 0.5) }] : [];
        return fillOf({ type, color1, color2, angle: pick([45, 90, 135, 160, 180]), stops });
      })(),
      border: Math.random() < 0.5 ? { width: 0.04, color: '#ffffff' } : { width: 0, color: '#ffffff' },
      gloss: Math.random() < 0.3,
      shadow: { ...DEFAULT_BACKGROUND.shadow, enabled: Math.random() < 0.3 },
    },
    layers: [makeLayer(content, { id: 'r0' })],
  };
}
