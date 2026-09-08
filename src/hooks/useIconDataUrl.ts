import { useMemo } from 'react';
import type { IconState } from '../model/types';
import { renderIcon } from '../render/renderIcon';
import { useResourceVersion } from './useResourceVersion';

let scratch: HTMLCanvasElement | null = null;

/**
 * A PNG data URL of the icon at `size` pixels. Discord downsizes the uploaded
 * image itself, so feeding a 64px PNG to the mock previews shows the real result.
 */
export function useIconDataUrl(state: IconState, size = 64): string {
  const version = useResourceVersion();
  return useMemo(() => {
    void version;
    if (typeof document === 'undefined') return '';
    scratch ??= document.createElement('canvas');
    scratch.width = size;
    scratch.height = size;
    const ctx = scratch.getContext('2d');
    if (!ctx) return '';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderIcon(ctx, state, size);
    return scratch.toDataURL('image/png');
  }, [state, size, version]);
}
