import { RANGES } from '../../model/types';
import { ColorField } from '../controls/ColorField';
import { Slider, percent, signedPercent } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';
import type { TabProps } from './types';

export function EffectsTab({ icon, updateIcon }: TabProps) {
  if (icon.background.shape === 'none') {
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
          value={icon.background.border.width}
          range={RANGES.borderWidth}
          format={percent}
          onChange={(value) =>
            updateIcon((draft) => {
              draft.background.border.width = value;
            })
          }
        />
        {icon.background.border.width > 0 && (
          <ColorField
            label="Border color"
            value={icon.background.border.color}
            onChange={(hex) =>
              updateIcon((draft) => {
                draft.background.border.color = hex;
              })
            }
          />
        )}
      </div>
      <div className="section">
        <h2 className="section__title">Shadow</h2>
        <Toggle
          label="Drop shadow"
          checked={icon.background.shadow.enabled}
          onChange={(checked) =>
            updateIcon((draft) => {
              draft.background.shadow.enabled = checked;
            })
          }
        />
        {icon.background.shadow.enabled && (
          <>
            <Slider
              label="Blur"
              value={icon.background.shadow.blur}
              range={RANGES.shadowBlur}
              format={percent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.shadow.blur = value;
                })
              }
            />
            <Slider
              label="Opacity"
              value={icon.background.shadow.opacity}
              range={RANGES.shadowOpacity}
              format={percent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.shadow.opacity = value;
                })
              }
            />
            <Slider
              label="Offset X"
              value={icon.background.shadow.dx}
              range={RANGES.shadowOffset}
              format={signedPercent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.shadow.dx = value;
                })
              }
            />
            <Slider
              label="Offset Y"
              value={icon.background.shadow.dy}
              range={RANGES.shadowOffset}
              format={signedPercent}
              onChange={(value) =>
                updateIcon((draft) => {
                  draft.background.shadow.dy = value;
                })
              }
            />
            <ColorField
              label="Shadow color"
              value={icon.background.shadow.color}
              onChange={(hex) =>
                updateIcon((draft) => {
                  draft.background.shadow.color = hex;
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
          checked={icon.background.gloss}
          onChange={(checked) =>
            updateIcon((draft) => {
              draft.background.gloss = checked;
            })
          }
        />
      </div>
    </>
  );
}
