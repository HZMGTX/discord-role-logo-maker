import { PRESETS, type Preset } from '../../model/presets';
import { IconThumb } from '../controls/IconThumb';

interface PresetGalleryProps {
  onSelect: (preset: Preset) => void;
}

export function PresetGallery({ onSelect }: PresetGalleryProps) {
  return (
    <div className="card">
      <div className="card__head">
        <h2 className="card__title">Start from a preset</h2>
        <span className="card__hint">then tweak anything</span>
      </div>
      <div className="presets" role="list">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="listitem"
            className="preset"
            onClick={() => onSelect(preset)}
            data-testid={`preset-${preset.id}`}
          >
            <IconThumb state={preset.icon} size={48} />
            <span className="preset__name">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
