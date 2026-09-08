import { useMemo } from 'react';
import { DEFAULT_ICON } from '../../model/defaults';
import { RANGES, SHAPES, SHAPE_LABELS, type IconState } from '../../model/types';
import { IconThumb } from '../controls/IconThumb';
import { Slider, percent } from '../controls/Slider';
import type { TabProps } from './types';

export function ShapeTab({ icon, updateIcon }: TabProps) {
  const thumbs = useMemo(
    () =>
      SHAPES.map((kind) => ({
        kind,
        state: {
          ...icon,
          shape: kind,
          content: { kind: 'none' as const },
          shadow: { ...icon.shadow, enabled: false },
          transform: DEFAULT_ICON.transform,
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
              aria-pressed={icon.shape === kind}
              onClick={() =>
                updateIcon((draft) => {
                  draft.shape = kind;
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
      {icon.shape === 'roundedSquare' && (
        <div className="section">
          <Slider
            label="Corner radius"
            value={icon.cornerRadius}
            range={RANGES.cornerRadius}
            format={percent}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.cornerRadius = value;
              })
            }
          />
        </div>
      )}
      {icon.shape === 'none' && (
        <p className="note">
          No background: only the content is drawn, on a transparent PNG. Border, shadow and
          gloss are skipped.
        </p>
      )}
    </>
  );
}
