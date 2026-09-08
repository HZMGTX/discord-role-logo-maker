import { ICON_FRIENDLY_EMOJI } from '../emoji/catalog';
import { DEFAULT_ICON, cloneIcon } from './defaults';
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
  const icon = cloneIcon(DEFAULT_ICON);
  const [color1, color2] = pick(COLOR_PAIRS);
  icon.shape = pick(SHAPES.filter((s) => s !== 'none'));
  icon.cornerRadius = 0.18 + Math.random() * 0.22;
  icon.fill = { type: pick(FILL_TYPES), color1, color2, angle: pick([45, 90, 135, 160, 180]) };
  icon.border = Math.random() < 0.5 ? { width: 0.04, color: '#ffffff' } : { width: 0, color: '#ffffff' };
  icon.gloss = Math.random() < 0.3;
  icon.shadow.enabled = Math.random() < 0.3;
  icon.content =
    Math.random() < 0.6
      ? { kind: 'emoji', emoji: pick(ICON_FRIENDLY_EMOJI), shadow: false }
      : { kind: 'symbol', symbol: pick(SYMBOL_IDS), color: '#ffffff', shadow: Math.random() < 0.4 };
  return icon;
}
