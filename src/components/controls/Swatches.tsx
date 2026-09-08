interface SwatchesProps {
  label: string;
  colors: readonly string[];
  value: string;
  onChange: (hex: string) => void;
}

export function Swatches({ label, colors, value, onChange }: SwatchesProps) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {colors.map((hex) => (
        <button
          key={hex}
          type="button"
          className="swatch"
          style={{ background: hex }}
          aria-label={hex}
          aria-pressed={hex === value}
          onClick={() => onChange(hex)}
        />
      ))}
    </div>
  );
}
