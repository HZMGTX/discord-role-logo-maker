import type { Content, ContentKind, IconState, PreviewSettings } from './types';

export const DEFAULT_ICON: IconState = {
  v: 1,
  shape: 'circle',
  cornerRadius: 0.25,
  sides: 6,
  innerRatio: 0.62,
  shapeRotation: 0,
  fill: { type: 'linear', color1: '#3498db', color2: '#206694', angle: 135 },
  border: { width: 0.04, color: '#ffffff' },
  shadow: { enabled: false, blur: 0.04, opacity: 0.35, dx: 0, dy: 0.02, color: '#000000' },
  gloss: false,
  content: { kind: 'emoji', emoji: '👑', shadow: false },
  transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 },
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
      return { kind: 'emoji', emoji: '👑', shadow: prevShadow };
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
    case 'image':
      return { kind: 'image', src: null, fit: 'cover', clip: true };
    case 'none':
      return { kind: 'none' };
  }
}

export function cloneIcon(state: IconState): IconState {
  return structuredClone(state);
}
