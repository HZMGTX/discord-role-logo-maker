import { describe, expect, it, vi } from 'vitest';
import { addLayer, duplicateLayer, ensureTopLayer, moveLayer, removeLayer } from './layers';
import { sanitizeIcon } from './serialize';
import { MAX_LAYERS, type IconState } from './types';

function iconWith(ids: string[]): IconState {
  return sanitizeIcon({
    v: 2,
    background: {},
    layers: ids.map((id) => ({ id, content: { kind: 'emoji', emoji: '⭐' } })),
  });
}

const STAR = { kind: 'emoji', emoji: '⭐', shadow: false } as const;

describe('layer ids', () => {
  it('never reuses an id after a reload', async () => {
    // The counter behind new ids restarts with the page while the saved design
    // does not, so a fresh session can hand out an id the restored stack is
    // already using. Resetting the modules is what a page load looks like.
    vi.resetModules();
    const freshDefaults = await import('./defaults');
    const freshLayers = await import('./layers');
    const freshSerialize = await import('./serialize');

    // Ids a previous session would have written into storage.
    const stored = freshSerialize.sanitizeIcon({
      v: 2,
      background: {},
      layers: ['l1', 'l2', 'l3'].map((id) => ({
        id,
        content: { kind: 'emoji', emoji: '⭐' },
      })),
    });
    expect(stored.layers.map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
    // The very first id this session would otherwise mint collides.
    expect(freshDefaults.nextLayerId()).toBe('l1');

    let icon = stored;
    for (let i = 0; i < 4; i += 1) {
      const added = freshLayers.addLayer(icon, STAR);
      icon = added.icon;
      expect(icon.layers.filter((l) => l.id === added.id)).toHaveLength(1);
    }
    expect(new Set(icon.layers.map((l) => l.id)).size).toBe(icon.layers.length);
  });

  it('never reuses an id when duplicating either', async () => {
    vi.resetModules();
    const freshLayers = await import('./layers');
    const freshSerialize = await import('./serialize');
    let icon = freshSerialize.sanitizeIcon({
      v: 2,
      background: {},
      layers: ['l1', 'l2'].map((id) => ({ id, content: { kind: 'emoji', emoji: '⭐' } })),
    });
    for (let i = 0; i < 3; i += 1) {
      icon = freshLayers.duplicateLayer(icon, 'l1').icon;
    }
    expect(icon.layers).toHaveLength(5);
    expect(new Set(icon.layers.map((l) => l.id)).size).toBe(5);
  });

  it('gives a duplicate its own id', () => {
    const icon = iconWith(['l1', 'l2']);
    const { icon: next, id } = duplicateLayer(icon, 'l1');
    expect(next.layers).toHaveLength(3);
    expect(new Set(next.layers.map((l) => l.id)).size).toBe(3);
    expect(id).not.toBe('l1');
  });

  it('gives a starter layer an id the stack is not using', () => {
    const icon = iconWith([]);
    expect(icon.layers).toEqual([]);
    const draft = structuredClone(icon);
    const layer = ensureTopLayer(draft);
    expect(draft.layers).toHaveLength(1);
    expect(layer.id).toBeTruthy();
  });
});

describe('removing a layer', () => {
  it('clears a mask that pointed at it', () => {
    const icon = sanitizeIcon({
      v: 2,
      background: {},
      layers: [
        { id: 'mask', content: { kind: 'symbol', symbol: 'star' } },
        { id: 'art', content: { kind: 'emoji', emoji: '⭐' }, clipTo: 'mask' },
        { id: 'other', content: { kind: 'emoji', emoji: '⭐' }, clipTo: 'art' },
      ],
    });
    const { icon: next } = removeLayer(icon, 'mask');
    expect(next.layers).toHaveLength(2);
    expect(next.layers.find((l) => l.id === 'art')?.clipTo).toBeNull();
    // A mask pointing somewhere else is left alone.
    expect(next.layers.find((l) => l.id === 'other')?.clipTo).toBe('art');
  });

  it('selects a neighbour and does nothing for an unknown id', () => {
    const icon = iconWith(['a', 'b', 'c']);
    expect(removeLayer(icon, 'b').id).toBe('c');
    expect(removeLayer(icon, 'c').id).toBe('b');
    const missing = removeLayer(icon, 'nope');
    expect(missing.icon).toBe(icon);
    expect(missing.id).toBeNull();
  });
});

describe('stack limits and ordering', () => {
  it('stops adding at the cap', () => {
    let icon = iconWith(Array.from({ length: MAX_LAYERS }, (_, i) => `s${i}`));
    const before = icon.layers.length;
    icon = addLayer(icon, STAR).icon;
    expect(icon.layers).toHaveLength(before);
  });

  it('moves a layer through the stack and stops at the ends', () => {
    const icon = iconWith(['a', 'b', 'c']);
    expect(moveLayer(icon, 'a', 1).layers.map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(moveLayer(icon, 'c', -1).layers.map((l) => l.id)).toEqual(['a', 'c', 'b']);
    expect(moveLayer(icon, 'a', -1)).toBe(icon);
    expect(moveLayer(icon, 'c', 1)).toBe(icon);
  });
});
