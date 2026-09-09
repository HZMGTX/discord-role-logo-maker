interface HeaderProps {
  onAskAi: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRandomize: () => void;
  onReset: () => void;
  onShare: () => void;
}

export function Header({
  onAskAi,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRandomize,
  onReset,
  onShare,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__brand">
        <svg className="header__logo" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3498db" />
              <stop offset="1" stopColor="#206694" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="28" fill="url(#brand-gradient)" stroke="#fff" strokeWidth="3" />
          <path d="M18 42V24l10 8 4-12 4 12 10-8v18z" fill="#f1c40f" />
          <rect x="18" y="43" width="28" height="4" rx="1" fill="#f1c40f" />
        </svg>
        <div>
          <h1 className="header__title">Role Icon Maker</h1>
          <p className="header__tagline">
            Design a Discord role icon, preview it in place, download a ready-to-upload PNG.
          </p>
        </div>
      </div>
      <div className="header__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          data-testid="undo"
        >
          ↶
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          data-testid="redo"
        >
          ↷
        </button>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="btn" onClick={onRandomize}>
          <span aria-hidden="true">🎲</span> Randomize
        </button>
        <button type="button" className="btn btn--primary" onClick={onAskAi} data-testid="ask-ai">
          <span aria-hidden="true">✨</span> Ask AI
        </button>
        <button type="button" className="btn" onClick={onShare}>
          Copy share link
        </button>
      </div>
    </header>
  );
}
