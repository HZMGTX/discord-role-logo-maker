import { useState } from 'react';
import { EMOJI_CATEGORIES } from '../../emoji/catalog';
import { firstEmoji, twemojiUrl } from '../../emoji/twemoji';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiImage({ emoji, size }: { emoji: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span style={{ fontSize: Math.round(size * 0.85), lineHeight: 1 }} aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={twemojiUrl(emoji)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [categoryId, setCategoryId] = useState(EMOJI_CATEGORIES[0]?.id ?? '');
  const [custom, setCustom] = useState('');
  const category = EMOJI_CATEGORIES.find((c) => c.id === categoryId) ?? EMOJI_CATEGORIES[0];

  return (
    <div className="section">
      <div className="field">
        <label className="field__label" htmlFor="emoji-paste">
          <span>Emoji</span>
          <span className="field__value">{value}</span>
        </label>
        <div className="field__row">
          <EmojiImage key={value} emoji={value} size={36} />
          <input
            id="emoji-paste"
            className="input"
            placeholder="Paste any emoji here"
            value={custom}
            onChange={(event) => {
              const text = event.target.value;
              const found = firstEmoji(text);
              if (found) {
                onChange(found);
                setCustom('');
              } else {
                setCustom(text);
              }
            }}
          />
        </div>
      </div>
      <div className="chip-row" role="group" aria-label="Emoji categories">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="chip"
            aria-pressed={c.id === category?.id}
            onClick={() => setCategoryId(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="emoji-grid" role="group" aria-label={`${category?.label ?? ''} emoji`}>
        {(category?.emoji ?? []).map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-btn"
            aria-label={emoji}
            aria-pressed={emoji === value}
            onClick={() => onChange(emoji)}
          >
            <EmojiImage emoji={emoji} size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}
