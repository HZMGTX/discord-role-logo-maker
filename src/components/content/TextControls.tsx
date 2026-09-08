import { useId } from 'react';
import { FONTS, FONT_WEIGHTS, RANGES, fontById, type Content, type FontId, type FontWeight } from '../../model/types';
import { ColorField } from '../controls/ColorField';
import { Field } from '../controls/Field';
import { Segmented } from '../controls/Segmented';
import { Select } from '../controls/Select';
import { Slider, percent } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';

type TextContent = Extract<Content, { kind: 'text' }>;

interface TextControlsProps {
  content: TextContent;
  patch: (mutate: (content: TextContent) => void) => void;
}

const FONT_OPTIONS: ReadonlyArray<{ value: FontId; label: string }> = FONTS.map((f) => ({
  value: f.id,
  label: f.label,
}));

const WEIGHT_LABELS: Record<FontWeight, string> = { 400: 'Regular', 700: 'Bold', 900: 'Black' };

export function TextControls({ content, patch }: TextControlsProps) {
  const id = useId();
  const font = fontById(content.font);
  const weightOptions = FONT_WEIGHTS.filter((w) => (font.weights as readonly number[]).includes(w)).map(
    (w) => ({ value: w, label: WEIGHT_LABELS[w] }),
  );

  return (
    <>
      <Field label="Text" htmlFor={id} value={`${Array.from(content.text).length}/8`}>
        <input
          id={id}
          className="input"
          value={content.text}
          maxLength={8}
          placeholder="Initials, a word, a number"
          onChange={(event) =>
            patch((c) => {
              c.text = Array.from(event.target.value).slice(0, 8).join('');
            })
          }
        />
      </Field>
      <Select
        label="Font"
        value={content.font}
        options={FONT_OPTIONS}
        onChange={(value) =>
          patch((c) => {
            c.font = value;
          })
        }
      />
      {weightOptions.length > 1 && (
        <Segmented
          label="Weight"
          options={weightOptions}
          value={content.weight}
          onChange={(value) =>
            patch((c) => {
              c.weight = value;
            })
          }
        />
      )}
      <ColorField
        label="Text color"
        value={content.color}
        onChange={(hex) =>
          patch((c) => {
            c.color = hex;
          })
        }
      />
      <Slider
        label="Letter spacing"
        value={content.letterSpacing}
        range={RANGES.letterSpacing}
        format={percent}
        onChange={(value) =>
          patch((c) => {
            c.letterSpacing = value;
          })
        }
      />
      <Toggle
        label="Outline"
        checked={content.stroke !== null}
        onChange={(checked) =>
          patch((c) => {
            c.stroke = checked ? { width: 0.1, color: '#000000' } : null;
          })
        }
      />
      {content.stroke && (
        <>
          <Slider
            label="Outline width"
            value={content.stroke.width}
            range={RANGES.strokeWidth}
            format={percent}
            onChange={(value) =>
              patch((c) => {
                if (c.stroke) c.stroke.width = value;
              })
            }
          />
          <ColorField
            label="Outline color"
            value={content.stroke.color}
            onChange={(hex) =>
              patch((c) => {
                if (c.stroke) c.stroke.color = hex;
              })
            }
          />
        </>
      )}
    </>
  );
}
