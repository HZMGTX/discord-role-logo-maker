import { MAX_FILL_STOPS, RANGES, type Fill, type FillType } from '../../model/types';
import { ColorField } from './ColorField';
import { Field } from './Field';
import { Segmented } from './Segmented';
import { Slider, degrees, percent, signedPercent } from './Slider';

interface FillControlsProps {
  fill: Fill;
  patch: (mutate: (fill: Fill) => void) => void;
  /** Heading for the fill type control. */
  label?: string;
}

const FILL_OPTIONS: ReadonlyArray<{ value: FillType; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'conic', label: 'Conic' },
];

const END_LABELS: Record<FillType, [string, string]> = {
  solid: ['Color', ''],
  linear: ['Start color', 'End color'],
  radial: ['Center color', 'Edge color'],
  conic: ['Start color', 'End color'],
};

/** A colour to drop in when the user adds a stop, halfway between the ends. */
function nextStopColor(fill: Fill): string {
  const last = fill.stops[fill.stops.length - 1];
  return last ? last.color : fill.color2;
}

/** A free position for a new stop that does not land on an existing one. */
function nextStopOffset(fill: Fill): number {
  if (fill.stops.length === 0) return 0.5;
  const sorted = [...fill.stops].sort((a, b) => a.offset - b.offset);
  let widest = { start: 0, end: 1 };
  let previous = 0;
  for (const stop of sorted) {
    if (stop.offset - previous > widest.end - widest.start) {
      widest = { start: previous, end: stop.offset };
    }
    previous = stop.offset;
  }
  if (1 - previous > widest.end - widest.start) widest = { start: previous, end: 1 };
  return Math.round(((widest.start + widest.end) / 2) * 100) / 100;
}

/**
 * Edits one fill: its type, its two end colors, any extra colors in between,
 * and where a radial or conic gradient is centered. Shared by the background
 * plate and by shape layers so both offer exactly the same options.
 */
export function FillControls({ fill, patch, label = 'Fill type' }: FillControlsProps) {
  const [startLabel, endLabel] = END_LABELS[fill.type];
  const gradient = fill.type !== 'solid';
  const centered = fill.type === 'radial' || fill.type === 'conic';

  return (
    <>
      <Segmented
        label={label}
        options={FILL_OPTIONS}
        value={fill.type}
        onChange={(value) =>
          patch((f) => {
            f.type = value;
          })
        }
      />
      <ColorField
        label={startLabel}
        value={fill.color1}
        onChange={(hex) =>
          patch((f) => {
            f.color1 = hex;
          })
        }
      />
      {gradient && (
        <>
          {fill.stops.map((stop, index) => (
            <div className="stop" key={index}>
              <ColorField
                label={`Color ${index + 2}`}
                value={stop.color}
                onChange={(hex) =>
                  patch((f) => {
                    const target = f.stops[index];
                    if (target) target.color = hex;
                  })
                }
              />
              <Slider
                label="Position"
                value={stop.offset}
                range={RANGES.stopOffset}
                format={percent}
                onChange={(value) =>
                  patch((f) => {
                    const target = f.stops[index];
                    if (!target) return;
                    target.offset = value;
                    // Kept sorted here as well as on load, so the numbering a
                    // row shows now is the numbering it keeps.
                    f.stops.sort((a, b) => a.offset - b.offset);
                  })
                }
              />
              <button
                type="button"
                className="btn btn--sm"
                onClick={() =>
                  patch((f) => {
                    f.stops.splice(index, 1);
                  })
                }
              >
                Remove color {index + 2}
              </button>
            </div>
          ))}
          <ColorField
            label={endLabel}
            value={fill.color2}
            onChange={(hex) =>
              patch((f) => {
                f.color2 = hex;
              })
            }
          />
          <Field label="Colors" value={`${fill.stops.length + 2} of ${MAX_FILL_STOPS + 2}`}>
            <div className="row">
              <button
                type="button"
                className="btn btn--sm"
                disabled={fill.stops.length >= MAX_FILL_STOPS}
                onClick={() =>
                  patch((f) => {
                    f.stops.push({ offset: nextStopOffset(f), color: nextStopColor(f) });
                    f.stops.sort((a, b) => a.offset - b.offset);
                  })
                }
              >
                Add a color
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() =>
                  patch((f) => {
                    [f.color1, f.color2] = [f.color2, f.color1];
                    for (const stop of f.stops) stop.offset = 1 - stop.offset;
                    f.stops.sort((a, b) => a.offset - b.offset);
                  })
                }
              >
                Reverse
              </button>
            </div>
          </Field>
          {fill.type !== 'radial' && (
            <Slider
              label={fill.type === 'conic' ? 'Start angle' : 'Angle'}
              value={fill.angle}
              range={RANGES.fillAngle}
              format={degrees}
              onChange={(value) =>
                patch((f) => {
                  f.angle = value;
                })
              }
            />
          )}
          {centered && (
            <>
              <Slider
                label="Center across"
                value={fill.cx}
                range={RANGES.fillCenter}
                format={signedPercent}
                onChange={(value) =>
                  patch((f) => {
                    f.cx = value;
                  })
                }
              />
              <Slider
                label="Center down"
                value={fill.cy}
                range={RANGES.fillCenter}
                format={signedPercent}
                onChange={(value) =>
                  patch((f) => {
                    f.cy = value;
                  })
                }
              />
            </>
          )}
          {fill.type === 'radial' && (
            <Slider
              label="Spread"
              value={fill.radius}
              range={RANGES.fillRadius}
              format={percent}
              onChange={(value) =>
                patch((f) => {
                  f.radius = value;
                })
              }
            />
          )}
        </>
      )}
    </>
  );
}
