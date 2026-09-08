import { DEFAULT_ICON, cloneIcon } from './defaults';
import type { IconState } from './types';

export interface Preset {
  id: string;
  name: string;
  roleColor: string;
  icon: IconState;
}

type Patch = (icon: IconState) => void;

function preset(id: string, name: string, roleColor: string, patch: Patch): Preset {
  const icon = cloneIcon(DEFAULT_ICON);
  icon.border.width = 0;
  patch(icon);
  return { id, name, roleColor, icon };
}

export const PRESETS: readonly Preset[] = [
  preset('admin', 'Admin', '#e74c3c', (i) => {
    i.shape = 'shield';
    i.fill = { type: 'linear', color1: '#ff5f5f', color2: '#b3121b', angle: 160 };
    i.border = { width: 0.04, color: '#ffffff' };
    i.gloss = true;
    i.shadow.enabled = true;
    i.content = { kind: 'symbol', symbol: 'crown', color: '#ffffff', shadow: false };
  }),
  preset('moderator', 'Moderator', '#2ecc71', (i) => {
    i.shape = 'circle';
    i.fill = { type: 'linear', color1: '#2ecc71', color2: '#1f8b4c', angle: 135 };
    i.border = { width: 0.04, color: '#ffffff' };
    i.content = { kind: 'symbol', symbol: 'shield', color: '#ffffff', shadow: false };
  }),
  preset('vip', 'VIP', '#f1c40f', (i) => {
    i.shape = 'roundedSquare';
    i.cornerRadius = 0.3;
    i.fill = { type: 'linear', color1: '#f1c40f', color2: '#e67e22', angle: 160 };
    i.gloss = true;
    i.content = {
      kind: 'text',
      text: 'VIP',
      font: 'bangers',
      weight: 400,
      color: '#3d2b00',
      letterSpacing: 0.02,
      stroke: null,
      shadow: false,
    };
  }),
  preset('booster', 'Server Booster', '#f47fff', (i) => {
    i.shape = 'circle';
    i.fill = { type: 'radial', color1: '#ff73fa', color2: '#b845c1', angle: 0 };
    i.content = { kind: 'symbol', symbol: 'gem', color: '#ffffff', shadow: true };
  }),
  preset('bot', 'Bot', '#3498db', (i) => {
    i.shape = 'roundedSquare';
    i.cornerRadius = 0.25;
    i.fill = { type: 'linear', color1: '#3498db', color2: '#206694', angle: 135 };
    i.content = { kind: 'emoji', emoji: '🤖', shadow: false };
  }),
  preset('verified', 'Verified', '#3498db', (i) => {
    i.shape = 'badge';
    i.fill = { type: 'solid', color1: '#3498db', color2: '#206694', angle: 0 };
    i.content = { kind: 'symbol', symbol: 'check', color: '#ffffff', shadow: false };
  }),
  preset('artist', 'Artist', '#9b59b6', (i) => {
    i.shape = 'circle';
    i.fill = { type: 'linear', color1: '#9b59b6', color2: '#e91e63', angle: 45 };
    i.content = { kind: 'emoji', emoji: '🎨', shadow: false };
  }),
  preset('gamer', 'Gamer', '#1abc9c', (i) => {
    i.shape = 'hexagon';
    i.fill = { type: 'linear', color1: '#1abc9c', color2: '#206694', angle: 135 };
    i.border = { width: 0.03, color: '#ffffff' };
    i.content = { kind: 'emoji', emoji: '🎮', shadow: false };
  }),
  preset('developer', 'Developer', '#2ecc71', (i) => {
    i.shape = 'roundedSquare';
    i.cornerRadius = 0.2;
    i.fill = { type: 'solid', color1: '#1e1f22', color2: '#3f4147', angle: 0 };
    i.border = { width: 0.04, color: '#2ecc71' };
    i.content = { kind: 'symbol', symbol: 'code', color: '#2ecc71', shadow: false };
  }),
  preset('streamer', 'Streamer', '#e91e63', (i) => {
    i.shape = 'circle';
    i.fill = { type: 'radial', color1: '#e91e63', color2: '#71368a', angle: 0 };
    i.content = { kind: 'symbol', symbol: 'bolt', color: '#ffffff', shadow: true };
  }),
  preset('dj', 'DJ', '#11806a', (i) => {
    i.shape = 'circle';
    i.fill = { type: 'linear', color1: '#11806a', color2: '#1abc9c', angle: 90 };
    i.content = { kind: 'symbol', symbol: 'note', color: '#ffffff', shadow: false };
  }),
  preset('nightowl', 'Night Owl', '#206694', (i) => {
    i.shape = 'circle';
    i.fill = { type: 'linear', color1: '#206694', color2: '#0f2a44', angle: 180 };
    i.content = { kind: 'symbol', symbol: 'moon', color: '#f1c40f', shadow: false };
  }),
];
