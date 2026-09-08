import { useIconCanvas } from '../../hooks/useIconCanvas';
import type { ExportSize, IconState } from '../../model/types';

interface PreviewStageProps {
  icon: IconState;
  iconUrl: string;
  exportSize: ExportSize;
  onDownload: () => void;
  busy: boolean;
}

const SIZES = [64, 32, 20, 16] as const;

export function PreviewStage({ icon, iconUrl, exportSize, onDownload, busy }: PreviewStageProps) {
  const { ref, result } = useIconCanvas(icon, 288);
  return (
    <div className="card preview">
      <div className="card__head" style={{ alignSelf: 'stretch' }}>
        <h2 className="card__title">Your icon</h2>
        <span className="card__hint">transparent background</span>
      </div>
      <div className="preview__frame" data-pending={result.pending} data-testid="preview">
        <canvas ref={ref} width={288} height={288} aria-label="Role icon preview" role="img" />
        <div className="preview__skeleton" aria-hidden="true" />
      </div>
      <div className="preview__sizes" aria-label="Icon at Discord sizes">
        {SIZES.map((size) => (
          <span key={size} className="preview__size">
            {iconUrl && <img src={iconUrl} width={size} height={size} alt="" />}
            {size} px
          </span>
        ))}
      </div>
      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={onDownload}
        disabled={busy}
      >
        Download {exportSize} px PNG
      </button>
    </div>
  );
}
