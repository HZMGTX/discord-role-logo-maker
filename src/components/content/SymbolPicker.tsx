import { DEFAULT_ICON } from '../../model/defaults';
import { SYMBOL_IDS, type IconState, type SymbolId } from '../../model/types';
import { SYMBOLS } from '../../render/symbols';
import { IconThumb } from '../controls/IconThumb';

const THUMBS: ReadonlyArray<{ id: SymbolId; state: IconState }> = SYMBOL_IDS.map((id) => ({
  id,
  state: {
    ...DEFAULT_ICON,
    shape: 'none',
    content: { kind: 'symbol', symbol: id, color: '#f2f3f5', shadow: false },
    transform: { scale: 1.3, x: 0, y: 0, rotation: 0, opacity: 1 },
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
