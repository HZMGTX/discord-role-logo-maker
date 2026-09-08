import { useIconCanvas } from '../../hooks/useIconCanvas';
import type { IconState } from '../../model/types';

interface IconThumbProps {
  state: IconState;
  size: number;
}

/** A small live-rendered canvas of an icon state (shape and symbol options, presets). */
export function IconThumb({ state, size }: IconThumbProps) {
  const { ref } = useIconCanvas(state, size);
  return <canvas ref={ref} width={size} height={size} aria-hidden="true" />;
}
