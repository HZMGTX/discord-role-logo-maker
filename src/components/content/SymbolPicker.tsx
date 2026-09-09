import { DEFAULT_BACKGROUND, DEFAULT_TRANSFORM, makeLayer } from '../../model/defaults';
import { SYMBOL_IDS, type IconState, type SymbolId } from '../../model/types';
import { SYMBOLS } from '../../render/symbols';
import { IconThumb } from '../controls/IconThumb';

// Each thumbnail is the symbol alone on a transparent plate. It has to be a
// real icon state, because the picker draws it through the same renderer as
// the icon itself.
const THUMBS: ReadonlyArray<{ id: SymbolId; state: IconState }> = SYMBOL_IDS.map((id) => ({
  id,
  state: {
    v: 2,
    background: { ...structuredClone(DEFAULT_BACKGROUND), shape: 'none' },
    layers: [
      makeLayer(
        { kind: 'symbol', symbol: id, color: '#f2f3f5', shadow: false },
        { transform: { ...DEFAULT_TRANSFORM, scale: 1.3 }, clip: false },
      ),
    ],
  },
}));

interface SymbolPickerProps {
  value: SymbolId;
  onChange: (symbol: SymbolId) => void;
}

export function SymbolPicker({ value, onChange }: SymbolPickerProps) {
  return (
    <div className="option-grid" role="group" aria-label="Symbol">
      {THUMBS.map(({ id, state }) => (
        <button
          key={id}
          type="button"
          className="option"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
        >
          <IconThumb state={state} size={32} />
          <span className="option__label">{SYMBOLS[id].label}</span>
        </button>
      ))}
    </div>
  );
}
