import { RANGES } from '../../model/types';
import { ColorField } from '../controls/ColorField';
import { Slider, percent, signedPercent } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';
import type { TabProps } from './types';

export function EffectsTab({ icon, updateIcon }: TabProps) {
  if (icon.shape === 'none') {
    return (
      <p className="note">
        Effects apply to the background shape. Pick a shape in the Shape tab to use a border,
        shadow or gloss.
      </p>
    );
  }
  return (
    <>
      <div className="section">
        <h2 className="section__title">Border</h2>
        <Slider
          label="Width"
          value={icon.border.width}
          range={RANGES.borderWidth}
          format={percent}
          onChange={(value) =>
            updateIcon((draft) => {
              draft.border.width = value;
            })
          }
        />
        {icon.border.width > 0 && (
          <ColorField
            label="Border color"
            value={icon.border.color}
            onChange={(hex) =>
              updateIcon((draft) => {
                draft.border.color = hex;
              })
            }
          />
        )}
      </div>
      <div className="section">
        <h2 className="section__title">Shadow</h2>
        <Toggle
          label="Drop shadow"
          checked={icon.shadow.enabled}
          onChange={(checked) =>
            updateIcon((draft) => {
              draft.shadow.enabled = checked;
            })
          }
        />
        {icon.shadow.enabled && (
          <>
            <Slider
              label="Blur"
              value={icon.shadow.blur}
              range={RANGES.shadowBlur}
              format={percent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.shadow.blur = value;
                })
              }
            />
            <Slider
              label="Opacity"
              value={icon.shadow.opacity}
              range={RANGES.shadowOpacity}
              format={percent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.shadow.opacity = value;
                })
              }
            />
            <Slider
              label="Offset X"
              value={icon.shadow.dx}
              range={RANGES.shadowOffset}
              format={signedPercent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.shadow.dx = value;
                })
              }
            />
            <Slider
              label="Offset Y"
              value={icon.shadow.dy}
              range={RANGES.shadowOffset}
              format={signedPercent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.shadow.dy = value;
                })
              }
            />
            <ColorField
              label="Shadow color"
              value={icon.shadow.color}
              onChange={(hex) =>
                updateIcon((draft) => {
                  draft.shadow.color = hex;
                })
              }
            />
          </>
        )}
      </div>
      <div className="section">
        <h2 className="section__title">Finish</h2>
        <Toggle
          label="Glossy highlight"
          checked={icon.gloss}
          onChange={(checked) =>
            updateIcon((draft) => {
              draft.gloss = checked;
            })
          }
        />
      </div>
    </>
  );
}
