import { useId } from 'react';
import type { Range } from '../../model/types';
import { Field } from './Field';

interface SliderProps {
  label: string;
  value: number;
  range: Range;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}

const defaultFormat = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const degrees = (value: number) => `${Math.round(value)}°`;
export const signedPercent = (value: number) => {
  const n = Math.round(value * 100);
  return n > 0 ? `+${n}%` : `${n}%`;
};

export function Slider({ label, value, range, onChange, format = defaultFormat }: SliderProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} value={format(value)}>
      <input
        id={id}
        className="slider"
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}
