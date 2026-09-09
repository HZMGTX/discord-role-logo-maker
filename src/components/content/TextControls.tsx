import { useEffect, useId, useState } from 'react';
import { FONTS, FONT_WEIGHTS, RANGES, fontById, type Content, type FontId, type FontWeight } from '../../model/types';
import { isValidFontName } from '../../model/types';
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
            c.customFont = null;
          })
        }
      />
      <CustomFontField content={content} patch={patch} />
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
        label="Letter outline"
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
            label="Letter outline width"
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
            label="Letter outline color"
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

interface CustomFontFieldProps {
  content: TextContent;
  patch: (mutate: (content: TextContent) => void) => void;
}

/** Lets the user name any Google Font instead of picking from the list. */
function CustomFontField({ content, patch }: CustomFontFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(content.customFont ?? '');

  useEffect(() => {
    setDraft(content.customFont ?? '');
  }, [content.customFont]);

  const commit = () => {
    const name = draft.trim();
    if (!name) {
      patch((c) => {
        c.customFont = null;
      });
      return;
    }
    if (isValidFontName(name)) {
      patch((c) => {
        c.customFont = name;
      });
    } else {
      setDraft(content.customFont ?? '');
    }
  };

  return (
    <Field label="Or any Google Font" htmlFor={id} value={content.customFont ? 'in use' : undefined}>
      <input
        id={id}
        className="input"
        placeholder="e.g. Comic Neue, Orbitron, Rampart One"
        value={draft}
        maxLength={40}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
    </Field>
  );
}
