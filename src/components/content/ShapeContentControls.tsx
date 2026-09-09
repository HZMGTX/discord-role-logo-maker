import { RANGES, SHAPES, SHAPE_LABELS, type Content, type ShapeKind } from '../../model/types';
import { ColorField } from '../controls/ColorField';
import { Segmented } from '../controls/Segmented';
import { Select } from '../controls/Select';
import { Slider, degrees, percent } from '../controls/Slider';

type ShapeContent = Extract<Content, { kind: 'shape' }>;

interface ShapeContentControlsProps {
  content: ShapeContent;
  patch: (mutate: (content: ShapeContent) => void) => void;
}

const SHAPE_OPTIONS: ReadonlyArray<{ value: ShapeKind; label: string }> = SHAPES.filter(
  (s) => s !== 'none',
).map((s) => ({ value: s, label: SHAPE_LABELS[s] }));

const FILL_OPTIONS = [
  { value: 'solid' as const, label: 'Solid' },
  { value: 'linear' as const, label: 'Linear' },
  { value: 'radial' as const, label: 'Radial' },
];

const POLYGON_SIDES = { min: 3, max: 12, step: 1 } as const;

/** A shape used as a layer: a plate, ring, accent or second silhouette. */
export function ShapeContentControls({ content, patch }: ShapeContentControlsProps) {
  return (
    <>
      <Select
        label="Shape"
        value={content.shape}
        options={SHAPE_OPTIONS}
        onChange={(value) =>
          patch((c) => {
            c.shape = value;
          })
        }
      />
      {content.shape === 'roundedSquare' && (
        <Slider
          label="Corner radius"
          value={content.cornerRadius}
          range={RANGES.cornerRadius}
          format={percent}
          onChange={(value) =>
            patch((c) => {
              c.cornerRadius = value;
            })
          }
        />
      )}
      {(content.shape === 'polygon' || content.shape === 'burst') && (
        <Slider
          label={content.shape === 'polygon' ? 'Sides' : 'Points'}
          value={content.sides}
          range={content.shape === 'polygon' ? POLYGON_SIDES : RANGES.sides}
          format={(value) => String(Math.round(value))}
          onChange={(value) =>
            patch((c) => {
              c.sides = Math.round(value);
            })
          }
        />
      )}
      {content.shape === 'burst' && (
        <Slider
          label="Spike depth"
          value={content.innerRatio}
          range={RANGES.innerRatio}
          format={percent}
          onChange={(value) =>
            patch((c) => {
              c.innerRatio = value;
            })
          }
        />
      )}
      <Slider
        label="Rotate shape"
        value={content.rotation}
        range={RANGES.shapeRotation}
        format={degrees}
        onChange={(value) =>
          patch((c) => {
            c.rotation = value;
          })
        }
      />
      <Segmented
        label="Fill"
        options={FILL_OPTIONS}
        value={content.fill.type}
        onChange={(value) =>
          patch((c) => {
            c.fill.type = value;
          })
        }
      />
      <ColorField
        label={content.fill.type === 'solid' ? 'Color' : 'Start color'}
        value={content.fill.color1}
        onChange={(hex) =>
          patch((c) => {
            c.fill.color1 = hex;
          })
        }
      />
      {content.fill.type !== 'solid' && (
        <>
          <ColorField
            label="End color"
            value={content.fill.color2}
            onChange={(hex) =>
              patch((c) => {
                c.fill.color2 = hex;
              })
            }
          />
          {content.fill.type === 'linear' && (
            <Slider
              label="Gradient angle"
              value={content.fill.angle}
              range={RANGES.fillAngle}
              format={degrees}
              onChange={(value) =>
                patch((c) => {
                  c.fill.angle = value;
                })
              }
            />
          )}
        </>
      )}
      <Slider
        label="Outline"
        value={content.border.width}
        range={RANGES.borderWidth}
        format={percent}
        onChange={(value) =>
          patch((c) => {
            c.border.width = value;
          })
        }
      />
      {content.border.width > 0 && (
        <ColorField
          label="Outline color"
          value={content.border.color}
          onChange={(hex) =>
            patch((c) => {
              c.border.color = hex;
            })
          }
        />
      )}
    </>
  );
}
