import { useEffect } from 'react';
import { STORAGE_KEY, serializePersisted, stripImages } from '../model/serialize';
import type { IconState, PreviewSettings } from '../model/types';

/** Saves the design to localStorage, debounced, so a reload picks up where you left off. */
export function usePersistedState(icon: IconState, preview: PreviewSettings): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serializePersisted(icon, preview));
      } catch {
        try {
          localStorage.setItem(STORAGE_KEY, serializePersisted(stripImages(icon), preview));
        } catch {
          // Storage unavailable (private mode, quota); the design still works for this session.
        }
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [icon, preview]);
}
