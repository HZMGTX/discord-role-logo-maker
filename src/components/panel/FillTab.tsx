import { RANGES, ROLE_COLORS, type FillType } from '../../model/types';
import { ColorField } from '../controls/ColorField';
import { Segmented } from '../controls/Segmented';
import { Slider, degrees } from '../controls/Slider';
import { Swatches } from '../controls/Swatches';
import type { TabProps } from './types';

const FILL_OPTIONS: ReadonlyArray<{ value: FillType; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
];

const LABELS: Record<FillType, [string, string]> = {
  solid: ['Color', ''],
  linear: ['Start color', 'End color'],
  radial: ['Center color', 'Edge color'],
};

export function FillTab({ icon, updateIcon }: TabProps) {
  const { fill } = icon.background;
  const [label1, label2] = LABELS[fill.type];
  return (
    <>
      <div className="section">
        <h2 className="section__title">Fill</h2>
        <Segmented
          label="Fill type"
          hideLabel
          options={FILL_OPTIONS}
          value={fill.type}
          onChange={(value) =>
            updateIcon((draft) => {
              draft.background.fill.type = value;
            })
          }
        />
        <ColorField
          label={label1}
          value={fill.color1}
          onChange={(hex) =>
            updateIcon((draft) => {
              draft.background.fill.color1 = hex;
            })
          }
        />
        {fill.type !== 'solid' && (
          <ColorField
            label={label2}
            value={fill.color2}
            onChange={(hex) =>
              updateIcon((draft) => {
                draft.background.fill.color2 = hex;
              })
            }
          />
        )}
        {fill.type === 'linear' && (
          <Slider
            label="Angle"
            value={fill.angle}
            range={RANGES.fillAngle}
            format={degrees}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.background.fill.angle = value;
              })
            }
          />
        )}
        {fill.type !== 'solid' && (
          <button
            type="button"
            className="btn btn--sm"
            onClick={() =>
              updateIcon((draft) => {
                [draft.background.fill.color1, draft.background.fill.color2] = [draft.background.fill.color2, draft.background.fill.color1];
              })
            }
          >
            Swap colors
          </button>
        )}
      </div>
      <div className="section">
        <h2 className="section__title">
          Discord role palette
          <span className="card__hint">sets the {label1.toLowerCase()}</span>
        </h2>
        <Swatches
          label="Discord role colors"
          colors={ROLE_COLORS}
          value={fill.color1}
          onChange={(hex) =>
            updateIcon((draft) => {
              draft.background.fill.color1 = hex;
            })
          }
        />
      </div>
    </>
  );
}
