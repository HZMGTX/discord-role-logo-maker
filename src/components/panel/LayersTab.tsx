import { DEFAULT_TRANSFORM, defaultContent, layerLabel } from '../../model/defaults';
import {
  addLayer,
  canAddLayer,
  duplicateLayer,
  findLayer,
  moveLayer,
  removeLayer,
} from '../../model/layers';
import {
  BLEND_LABELS,
  BLEND_MODES,
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  MAX_LAYERS,
  RANGES,
  type BlendMode,
  type Content,
  type ContentKind,
  type IconState,
} from '../../model/types';
import { EmojiPicker } from '../content/EmojiPicker';
import { ImageUpload } from '../content/ImageUpload';
import { ShapeContentControls } from '../content/ShapeContentControls';
import { SymbolPicker } from '../content/SymbolPicker';
import { TextControls } from '../content/TextControls';
import { ColorField } from '../controls/ColorField';
import { Segmented } from '../controls/Segmented';
import { Select } from '../controls/Select';
import { Slider, degrees, percent, signedPercent } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';
import type { IconUpdater } from './types';

interface LayersTabProps {
  icon: IconState;
  updateIcon: IconUpdater;
  setIcon: (next: IconState) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  notify: (message: string) => void;
}

const ADD_KINDS: readonly ContentKind[] = CONTENT_KINDS.filter((k) => k !== 'none');

const BLEND_OPTIONS: ReadonlyArray<{ value: BlendMode; label: string }> = BLEND_MODES.map((m) => ({
  value: m,
  label: BLEND_LABELS[m] ?? m.replace(/^./, (c) => c.toUpperCase()),
}));

const BLEND_HINTS: Partial<Record<BlendMode, string>> = {
  erase: 'Punches this layer out of everything below it.',
  stencil: 'Keeps what is below only where this layer covers it.',
};

export function LayersTab({
  icon,
  updateIcon,
  setIcon,
  selectedLayerId,
  onSelectLayer,
  notify,
}: LayersTabProps) {
  const selected = findLayer(icon, selectedLayerId) ?? icon.layers[icon.layers.length - 1] ?? null;
  const selectedId = selected?.id ?? null;
  // Any other layer can act as a mask; its shape alone is used, so a pair of
  // layers pointing at each other is harmless.
  const maskOptions = [
    { value: '', label: 'No mask' },
    ...icon.layers
      .filter((l) => l.id !== selectedId && l.content.kind !== 'none')
      .map((l) => ({ value: l.id, label: layerLabel(l) })),
  ];

  const patchLayer = (mutate: (layer: NonNullable<typeof selected>) => void) =>
    updateIcon((draft) => {
      const layer = draft.layers.find((l) => l.id === selectedId);
      if (layer) mutate(layer);
    });

  const patchKind = <K extends Content['kind']>(
    kind: K,
    mutate: (content: Extract<Content, { kind: K }>) => void,
  ) =>
    patchLayer((layer) => {
      if (layer.content.kind === kind) mutate(layer.content as Extract<Content, { kind: K }>);
    });

  const add = (kind: ContentKind) => {
    if (!canAddLayer(icon)) {
      notify(`That is the most layers one icon can hold (${MAX_LAYERS}).`);
      return;
    }
    const result = addLayer(icon, defaultContent(kind));
    setIcon(result.icon);
    onSelectLayer(result.id);
  };

  const content = selected?.content ?? null;

  return (
    <>
      <div className="section">
        <h2 className="section__title">
          Layers
          <span className="card__hint">
            {icon.layers.length} of {MAX_LAYERS}
          </span>
        </h2>
        {icon.layers.length === 0 ? (
          <p className="note">
            Just the background plate right now. Add a layer below to put something on it.
          </p>
        ) : (
          <ul className="layers" role="list">
            {[...icon.layers].reverse().map((layer) => (
              <li key={layer.id}>
                <div className={`layer${layer.id === selectedId ? ' layer--active' : ''}`}>
                  <button
                    type="button"
                    className="layer__pick"
                    aria-pressed={layer.id === selectedId}
                    onClick={() => onSelectLayer(layer.id)}
                    data-testid={`layer-${layer.id}`}
                  >
                    <span className="layer__kind">{CONTENT_KIND_LABELS[layer.content.kind]}</span>
                    <span className="layer__name">{layerLabel(layer)}</span>
                  </button>
                  <button
                    type="button"
                    className="layer__icon"
                    aria-label={layer.hidden ? `Show ${layerLabel(layer)}` : `Hide ${layerLabel(layer)}`}
                    aria-pressed={layer.hidden}
                    onClick={() =>
                      updateIcon((draft) => {
                        const target = draft.layers.find((l) => l.id === layer.id);
                        if (target) target.hidden = !target.hidden;
                      })
                    }
                  >
                    {layer.hidden ? '🚫' : '👁'}
                  </button>
                  <button
                    type="button"
                    className="layer__icon"
                    aria-label={`Move ${layerLabel(layer)} up`}
                    disabled={layer.id === icon.layers[icon.layers.length - 1]?.id}
                    onClick={() => setIcon(moveLayer(icon, layer.id, 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="layer__icon"
                    aria-label={`Move ${layerLabel(layer)} down`}
                    disabled={layer.id === icon.layers[0]?.id}
                    onClick={() => setIcon(moveLayer(icon, layer.id, -1))}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="chip-row" role="group" aria-label="Add a layer">
          {ADD_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="chip"
              onClick={() => add(kind)}
              data-testid={`add-layer-${kind}`}
            >
              + {CONTENT_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
        {selected && (
          <div className="actions actions--row">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                const result = duplicateLayer(icon, selected.id);
                setIcon(result.icon);
                onSelectLayer(result.id);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                const result = removeLayer(icon, selected.id);
                setIcon(result.icon);
                onSelectLayer(result.id);
              }}
              data-testid="delete-layer"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {selected && content && (
        <>
          <div className="section">
            <h2 className="section__title">
              Editing
              <span className="card__hint">{layerLabel(selected)}</span>
            </h2>
            <Segmented
              label="Layer type"
              hideLabel
              options={ADD_KINDS.map((k) => ({ value: k, label: CONTENT_KIND_LABELS[k] }))}
              value={content.kind === 'none' ? 'emoji' : content.kind}
              onChange={(kind) =>
                patchLayer((layer) => {
                  if (layer.content.kind !== kind)
                    layer.content = defaultContent(kind, layer.content);
                })
              }
            />
            {content.kind === 'emoji' && (
              <EmojiPicker
                value={content.emoji}
                onChange={(emoji) =>
                  patchKind('emoji', (c) => {
                    c.emoji = emoji;
                  })
                }
              />
            )}
            {content.kind === 'text' && (
              <TextControls content={content} patch={(mutate) => patchKind('text', mutate)} />
            )}
            {content.kind === 'symbol' && (
              <>
                <SymbolPicker
                  value={content.symbol}
                  onChange={(symbol) =>
                    patchKind('symbol', (c) => {
                      c.symbol = symbol;
                    })
                  }
                />
                <ColorField
                  label="Symbol color"
                  value={content.color}
                  onChange={(hex) =>
                    patchKind('symbol', (c) => {
                      c.color = hex;
                    })
                  }
                />
              </>
            )}
            {content.kind === 'shape' && (
              <ShapeContentControls
                content={content}
                patch={(mutate) => patchKind('shape', mutate)}
              />
            )}
            {content.kind === 'image' && (
              <ImageUpload
                content={content}
                patch={(mutate) => patchKind('image', mutate)}
                notify={notify}
              />
            )}
          </div>

          <div className="section">
            <h2 className="section__title">
              Placement
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() =>
                  patchLayer((layer) => {
                    layer.transform = { ...DEFAULT_TRANSFORM };
                  })
                }
              >
                Reset
              </button>
            </h2>
            <Slider
              label="Size"
              value={selected.transform.scale}
              range={RANGES.scale}
              format={percent}
              onChange={(value) =>
                patchLayer((layer) => {
                  layer.transform.scale = value;
                })
              }
            />
            <Slider
              label="Horizontal offset"
              value={selected.transform.x}
              range={RANGES.offset}
              format={signedPercent}
              onChange={(value) =>
                patchLayer((layer) => {
                  layer.transform.x = value;
                })
              }
            />
            <Slider
              label="Vertical offset"
              value={selected.transform.y}
              range={RANGES.offset}
              format={signedPercent}
              onChange={(value) =>
                patchLayer((layer) => {
                  layer.transform.y = value;
                })
              }
            />
            <Slider
              label="Rotation"
              value={selected.transform.rotation}
              range={RANGES.rotation}
              format={degrees}
              onChange={(value) =>
                patchLayer((layer) => {
                  layer.transform.rotation = value;
                })
              }
            />
            <Slider
              label="Opacity"
              value={selected.transform.opacity}
              range={RANGES.opacity}
              format={percent}
              onChange={(value) =>
                patchLayer((layer) => {
                  layer.transform.opacity = value;
                })
              }
            />
            <Toggle
              label="Flip horizontally"
              checked={selected.transform.flipX}
              onChange={(checked) =>
                patchLayer((layer) => {
                  layer.transform.flipX = checked;
                })
              }
            />
            <Toggle
              label="Flip vertically"
              checked={selected.transform.flipY}
              onChange={(checked) =>
                patchLayer((layer) => {
                  layer.transform.flipY = checked;
                })
              }
            />
          </div>

          <div className="section">
            <h2 className="section__title">Layer options</h2>
            {icon.background.shape !== 'none' && (
              <Toggle
                label="Keep inside the shape"
                checked={selected.clip}
                onChange={(checked) =>
                  patchLayer((layer) => {
                    layer.clip = checked;
                  })
                }
              />
            )}
            {'shadow' in content && (
              <Toggle
                label="Drop shadow"
                checked={content.shadow}
                onChange={(checked) =>
                  patchLayer((layer) => {
                    if ('shadow' in layer.content) layer.content.shadow = checked;
                  })
                }
              />
            )}
            <Select
              label="Blend mode"
              value={selected.blend}
              options={BLEND_OPTIONS}
              onChange={(value) =>
                patchLayer((layer) => {
                  layer.blend = value;
                })
              }
            />
            {BLEND_HINTS[selected.blend] && (
              <p className="card__hint">{BLEND_HINTS[selected.blend]}</p>
            )}
            {maskOptions.length > 1 && (
              <Select
                label="Mask to layer"
                value={selected.clipTo ?? ''}
                options={maskOptions}
                onChange={(value) =>
                  patchLayer((layer) => {
                    layer.clipTo = value === '' ? null : value;
                  })
                }
              />
            )}
          </div>

          <div className="section">
            <h2 className="section__title">
              Effects
              <span className="card__hint">work on any layer, pictures included</span>
            </h2>
            <Toggle
              label="Glow"
              checked={selected.effects.glow !== null}
              onChange={(checked) =>
                patchLayer((layer) => {
                  layer.effects.glow = checked
                    ? { color: '#ffffff', blur: 0.05, opacity: 0.7 }
                    : null;
                })
              }
            />
            {selected.effects.glow && (
              <>
                <ColorField
                  label="Glow color"
                  value={selected.effects.glow.color}
                  onChange={(hex) =>
                    patchLayer((layer) => {
                      if (layer.effects.glow) layer.effects.glow.color = hex;
                    })
                  }
                />
                <Slider
                  label="Glow size"
                  value={selected.effects.glow.blur}
                  range={RANGES.glowBlur}
                  format={percent}
                  onChange={(value) =>
                    patchLayer((layer) => {
                      if (layer.effects.glow) layer.effects.glow.blur = value;
                    })
                  }
                />
                <Slider
                  label="Glow strength"
                  value={selected.effects.glow.opacity}
                  range={RANGES.glowOpacity}
                  format={percent}
                  onChange={(value) =>
                    patchLayer((layer) => {
                      if (layer.effects.glow) layer.effects.glow.opacity = value;
                    })
                  }
                />
              </>
            )}
            <Toggle
              label="Outline"
              checked={selected.effects.outline !== null}
              onChange={(checked) =>
                patchLayer((layer) => {
                  layer.effects.outline = checked ? { width: 0.012, color: '#000000' } : null;
                })
              }
            />
            {selected.effects.outline && (
              <>
                <ColorField
                  label="Outline color"
                  value={selected.effects.outline.color}
                  onChange={(hex) =>
                    patchLayer((layer) => {
                      if (layer.effects.outline) layer.effects.outline.color = hex;
                    })
                  }
                />
                <Slider
                  label="Outline width"
                  value={selected.effects.outline.width}
                  range={RANGES.outlineWidth}
                  format={percent}
                  onChange={(value) =>
                    patchLayer((layer) => {
                      if (layer.effects.outline) layer.effects.outline.width = value;
                    })
                  }
                />
              </>
            )}
            <Toggle
              label="Recolor"
              checked={selected.effects.tint !== null}
              onChange={(checked) =>
                patchLayer((layer) => {
                  layer.effects.tint = checked ? { color: '#ffffff', amount: 1 } : null;
                })
              }
            />
            {selected.effects.tint && (
              <>
                <ColorField
                  label="Recolor to"
                  value={selected.effects.tint.color}
                  onChange={(hex) =>
                    patchLayer((layer) => {
                      if (layer.effects.tint) layer.effects.tint.color = hex;
                    })
                  }
                />
                <Slider
                  label="Recolor strength"
                  value={selected.effects.tint.amount}
                  range={RANGES.tintAmount}
                  format={percent}
                  onChange={(value) =>
                    patchLayer((layer) => {
                      if (layer.effects.tint) layer.effects.tint.amount = value;
                    })
                  }
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
