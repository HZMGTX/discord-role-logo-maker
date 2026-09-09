import { MAX_FILL_STOPS, RANGES, type Fill, type FillType } from '../../model/types';
import { mix } from '../../render/color';
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

/**
 * Where a new stop should sit: the middle of the widest gap in the ramp, so
 * repeated clicks spread out instead of piling up on one spot.
 */
function nextStopOffset(fill: Fill): number {
  const sorted = [...fill.stops].sort((a, b) => a.offset - b.offset);
  let best = { start: 0, end: 1 };
  let previous = 0;
  for (const stop of sorted) {
    if (stop.offset - previous > best.end - best.start) best = { start: previous, end: stop.offset };
    previous = stop.offset;
  }
  if (1 - previous > best.end - best.start) best = { start: previous, end: 1 };
  return Math.round(((best.start + best.end) / 2) * 100) / 100;
}

/** The color already at `offset`, so a new stop starts invisible and is then tuned. */
function colorAt(fill: Fill, offset: number): string {
  const ramp = [
    { offset: 0, color: fill.color1 },
    ...[...fill.stops].sort((a, b) => a.offset - b.offset),
    { offset: 1, color: fill.color2 },
  ];
  for (let i = 1; i < ramp.length; i += 1) {
    const before = ramp[i - 1];
    const after = ramp[i];
    if (!before || !after || offset > after.offset) continue;
    const span = after.offset - before.offset;
    return mix(before.color, after.color, span <= 0 ? 0 : (offset - before.offset) / span);
  }
  return fill.color2;
}

/**
 * Edits one fill: its type, its two end colors, any extra colors in between,
 * and where the gradient is centered. Shared by the background plate and by
 * shape layers so both offer exactly the same options.
 */
export function FillControls({ fill, patch, label = 'Fill type' }: FillControlsProps) {
  const [startLabel, endLabel] = END_LABELS[fill.type];
  const gradient = fill.type !== 'solid';

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
                    if (target) target.offset = value;
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
                    const offset = nextStopOffset(f);
                    f.stops.push({ offset, color: colorAt(f, offset) });
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
