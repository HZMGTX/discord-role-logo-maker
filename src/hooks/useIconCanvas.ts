import { useEffect, useRef, useState, type RefObject } from 'react';
import type { IconState } from '../model/types';
import { renderIcon, type RenderResult } from '../render/renderIcon';
import { useResourceVersion } from './useResourceVersion';

const IDLE: RenderResult = { pending: false, emojiFallback: false };

/**
 * Keeps a canvas element painted with the icon at `cssSize` CSS pixels
 * (rendered at the device pixel ratio), repainting when state or resources change.
 */
export function useIconCanvas(
  state: IconState,
  cssSize: number,
): { ref: RefObject<HTMLCanvasElement | null>; result: RenderResult } {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [result, setResult] = useState<RenderResult>(IDLE);
  const version = useResourceVersion();
  const [dprTick, setDprTick] = useState(0);

  useEffect(() => {
    const onResize = () => setDprTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const frame = window.requestAnimationFrame(() => {
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const px = Math.round(cssSize * dpr);
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const next = renderIcon(ctx, state, cssSize);
      setResult((prev) =>
        prev.pending === next.pending && prev.emojiFallback === next.emojiFallback ? prev : next,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state, cssSize, version, dprTick]);

  return { ref, result };
}
