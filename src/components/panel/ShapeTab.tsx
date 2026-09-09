import { useMemo } from 'react';
import { RANGES, SHAPES, SHAPE_LABELS, type IconState } from '../../model/types';
import { IconThumb } from '../controls/IconThumb';
import { Slider, degrees, percent } from '../controls/Slider';

const POLYGON_SIDES = { min: 3, max: 12, step: 1 } as const;
import type { TabProps } from './types';

export function ShapeTab({ icon, updateIcon }: TabProps) {
  const thumbs = useMemo(
    () =>
      SHAPES.map((kind) => ({
        kind,
        state: {
          ...icon,
          background: {
            ...icon.background,
            shape: kind,
            shadow: { ...icon.background.shadow, enabled: false },
          },
          layers: [],
        } satisfies IconState,
      })),
    [icon],
  );

  return (
    <>
      <div className="section">
        <h2 className="section__title">Background shape</h2>
        <div className="option-grid" role="group" aria-label="Background shape">
          {thumbs.map(({ kind, state }) => (
            <button
              key={kind}
              type="button"
              className="option"
              aria-pressed={icon.background.shape === kind}
              onClick={() =>
                updateIcon((draft) => {
                  draft.background.shape = kind;
                })
              }
            >
              {kind === 'none' ? (
                <span className="option__none" aria-hidden="true">
                  Off
                </span>
              ) : (
                <IconThumb state={state} size={32} />
              )}
              <span className="option__label">{SHAPE_LABELS[kind]}</span>
            </button>
          ))}
        </div>
      </div>
      {icon.background.shape !== 'none' && (
        <div className="section">
          <h2 className="section__title">Fine tune</h2>
          {icon.background.shape === 'roundedSquare' && (
            <Slider
              label="Corner radius"
              value={icon.background.cornerRadius}
              range={RANGES.cornerRadius}
              format={percent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.cornerRadius = value;
                })
              }
            />
          )}
          {(icon.background.shape === 'polygon' || icon.background.shape === 'burst') && (
            <Slider
              label={icon.background.shape === 'polygon' ? 'Sides' : 'Points'}
              value={icon.background.sides}
              range={icon.background.shape === 'polygon' ? POLYGON_SIDES : RANGES.sides}
              format={(value) => String(Math.round(value))}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.sides = Math.round(value);
                })
              }
            />
          )}
          {icon.background.shape === 'burst' && (
            <Slider
              label="Spike depth"
              value={icon.background.innerRatio}
              range={RANGES.innerRatio}
              format={percent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.innerRatio = value;
                })
              }
            />
          )}
          <Slider
            label="Rotate shape"
            value={icon.background.rotation}
            range={RANGES.shapeRotation}
            format={degrees}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.background.rotation = value;
              })
            }
          />
        </div>
      )}
      {icon.background.shape === 'none' && (
        <p className="note">
          No background: only the content is drawn, on a transparent PNG. Border, shadow and
          gloss are skipped.
        </p>
      )}
    </>
  );
}
