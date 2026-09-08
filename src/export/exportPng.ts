import type { IconState } from '../model/types';
import { renderIcon } from '../render/renderIcon';
import { resources } from '../render/resources';

export interface ExportResult {
  blob: Blob;
  bytes: number;
  emojiFallback: boolean;
}

/** Renders the icon at an exact pixel size, waiting for fonts and images to arrive. */
export async function renderToCanvas(
  state: IconState,
  size: number,
): Promise<{ canvas: HTMLCanvasElement; emojiFallback: boolean }> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  let result = renderIcon(ctx, state, size);
  for (let attempt = 0; attempt < 4 && result.pending; attempt++) {
    await resources.whenIdle();
    result = renderIcon(ctx, state, size);
  }
  return { canvas, emojiFallback: result.emojiFallback };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the PNG'))),
      'image/png',
    );
  });
}

export async function renderToBlob(state: IconState, size: number): Promise<ExportResult> {
  const { canvas, emojiFallback } = await renderToCanvas(state, size);
  const blob = await canvasToBlob(canvas);
  return { blob, bytes: blob.size, emojiFallback };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canCopyImages(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

/** Must be called synchronously inside a user gesture (Safari requirement). */
export function copyPngToClipboard(blob: Promise<Blob>): Promise<void> {
  const item = new ClipboardItem({ 'image/png': blob });
  return navigator.clipboard.write([item]);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
