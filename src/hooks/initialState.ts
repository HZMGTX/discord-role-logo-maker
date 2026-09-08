import { DEFAULT_ICON, DEFAULT_PREVIEW } from '../model/defaults';
import { STORAGE_KEY, decodeShare, parsePersisted, readShareHash } from '../model/serialize';
import type { IconState, PreviewSettings } from '../model/types';

export interface InitialState {
  icon: IconState;
  preview: PreviewSettings;
  source: 'share' | 'storage' | 'default';
}

/** Share link first, then the last saved design, then the defaults. */
export function loadInitialState(): InitialState {
  if (typeof window === 'undefined') {
    return { icon: DEFAULT_ICON, preview: DEFAULT_PREVIEW, source: 'default' };
  }
  const encoded = readShareHash(window.location.hash);
  if (encoded) {
    const shared = decodeShare(encoded);
    if (shared) return { ...shared, source: 'share' };
  }
  try {
    const stored = parsePersisted(localStorage.getItem(STORAGE_KEY));
    if (stored) return { icon: stored.icon, preview: stored.preview, source: 'storage' };
  } catch {
    // localStorage can throw in some privacy modes; fall through to the defaults.
  }
  return { icon: DEFAULT_ICON, preview: DEFAULT_PREVIEW, source: 'default' };
}
