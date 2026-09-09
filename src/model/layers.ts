import { makeLayer, nextLayerId } from './defaults';
import { MAX_LAYERS, type Content, type IconState, type Layer } from './types';

/** Pure helpers for the layer stack. `layers[0]` is the bottom of the stack. */

export function findLayer(icon: IconState, id: string | null): Layer | null {
  if (!id) return null;
  return icon.layers.find((l) => l.id === id) ?? null;
}

export function layerIndex(icon: IconState, id: string | null): number {
  return id ? icon.layers.findIndex((l) => l.id === id) : -1;
}

export function canAddLayer(icon: IconState): boolean {
  return icon.layers.length < MAX_LAYERS;
}

/** Adds a layer on top and returns both the new state and the new layer's id. */
export function addLayer(icon: IconState, content: Content): { icon: IconState; id: string } {
  if (!canAddLayer(icon)) return { icon, id: icon.layers[icon.layers.length - 1]?.id ?? '' };
  const layer = makeLayer(content);
  return { icon: { ...icon, layers: [...icon.layers, layer] }, id: layer.id };
}

export function duplicateLayer(icon: IconState, id: string): { icon: IconState; id: string } {
  const index = layerIndex(icon, id);
  const source = icon.layers[index];
  if (index < 0 || !source || !canAddLayer(icon)) return { icon, id };
  const copy: Layer = { ...structuredClone(source), id: nextLayerId() };
  const layers = [...icon.layers];
  layers.splice(index + 1, 0, copy);
  return { icon: { ...icon, layers }, id: copy.id };
}

/** Removes a layer and returns the id that should be selected next. */
export function removeLayer(icon: IconState, id: string): { icon: IconState; id: string | null } {
  const index = layerIndex(icon, id);
  if (index < 0) return { icon, id: null };
  const layers = icon.layers.filter((l) => l.id !== id);
  const next = layers[Math.min(index, layers.length - 1)];
  return { icon: { ...icon, layers }, id: next ? next.id : null };
}

/** Moves a layer one step through the stack. `delta` of +1 moves it up (towards the front). */
export function moveLayer(icon: IconState, id: string, delta: number): IconState {
  const from = layerIndex(icon, id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= icon.layers.length) return icon;
  const layers = [...icon.layers];
  const [moved] = layers.splice(from, 1);
  if (!moved) return icon;
  layers.splice(to, 0, moved);
  return { ...icon, layers };
}

/**
 * The layer the rule-based assistant treats as "the icon's content": the
 * top-most one. Creates a starter layer when the icon is bare, so a tweak like
 * "use a crown" always has somewhere to land. Mutates `icon`, so pass a draft.
 */
export function ensureTopLayer(icon: IconState): Layer {
  const existing = icon.layers[icon.layers.length - 1];
  if (existing) return existing;
  const layer = makeLayer({ kind: 'emoji', emoji: '\u{2B50}', shadow: false });
  icon.layers.push(layer);
  return layer;
}
