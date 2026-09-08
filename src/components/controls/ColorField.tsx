import { useEffect, useId, useState } from 'react';
import { isValidHex } from '../../render/color';
import { Field } from './Field';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

function normalizeHex(input: string): string | null {
  let hex = input.trim().toLowerCase();
  if (!hex.startsWith('#')) hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return isValidHex(hex) ? hex : null;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = useId();
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const commit = () => {
    const hex = normalizeHex(text);
    if (hex) {
      onChange(hex);
      setText(hex);
    } else {
      setText(value);
    }
  };

  return (
    <Field label={label} htmlFor={id}>
      <div className="color-field">
        <span className="color-field__swatch" style={{ background: value }}>
          <input
            type="color"
            value={value}
            aria-label={`${label} picker`}
            onChange={(event) => onChange(event.target.value)}
          />
        </span>
        <input
          id={id}
          className="input input--mono"
          value={text}
          spellCheck={false}
          maxLength={7}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </div>
    </Field>
  );
}
