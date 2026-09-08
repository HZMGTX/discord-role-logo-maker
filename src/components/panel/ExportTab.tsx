import { useEffect, useState } from 'react';
import {
  canCopyImages,
  copyPngToClipboard,
  downloadBlob,
  formatBytes,
  renderToBlob,
} from '../../export/exportPng';
import { exportFilename } from '../../model/slug';
import {
  DISCORD_MAX_BYTES,
  EXPORT_SIZES,
  type ExportSize,
  type IconState,
  type PreviewSettings,
} from '../../model/types';
import { Segmented } from '../controls/Segmented';

interface ExportTabProps {
  icon: IconState;
  preview: PreviewSettings;
  size: ExportSize;
  onSizeChange: (size: ExportSize) => void;
  onShare: () => void;
  notify: (message: string) => void;
}

const SIZE_OPTIONS = EXPORT_SIZES.map((size) => ({ value: size, label: `${size} px` }));

interface Estimate {
  bytes: number;
  emojiFallback: boolean;
}

export function ExportTab({ icon, preview, size, onSizeChange, onShare, notify }: ExportTabProps) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEstimate(null);
    const timer = window.setTimeout(() => {
      renderToBlob(icon, size).then(
        (result) => {
          if (!cancelled) setEstimate({ bytes: result.bytes, emojiFallback: result.emojiFallback });
        },
        () => {
          if (!cancelled) setEstimate(null);
        },
      );
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [icon, size]);

  const download = async () => {
    setBusy(true);
    try {
      const { blob, bytes } = await renderToBlob(icon, size);
      downloadBlob(blob, exportFilename(preview.roleName, size));
      notify(`Downloaded ${size}×${size} PNG (${formatBytes(bytes)})`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    const blob = renderToBlob(icon, size).then((result) => result.blob);
    copyPngToClipboard(blob).then(
      () => notify('PNG copied to the clipboard'),
      () => notify('Clipboard unavailable here, use Download instead'),
    );
  };

  const tooBig = estimate !== null && estimate.bytes > DISCORD_MAX_BYTES;

  return (
    <>
      <div className="section">
        <h2 className="section__title">Export</h2>
        <Segmented label="Image size" options={SIZE_OPTIONS} value={size} onChange={onSizeChange} />
        <div className="stat">
          <span>Estimated file size</span>
          <span className="stat__value" data-testid="size-estimate">
            {estimate ? formatBytes(estimate.bytes) : '…'}
          </span>
        </div>
        {tooBig ? (
          <p className="note note--warning" role="alert">
            Discord rejects role icons over 256 KB. Pick 256 px or a simpler fill.
          </p>
        ) : (
          estimate && <p className="note note--ok">Within Discord&apos;s 256 KB limit.</p>
        )}
        {estimate?.emojiFallback && (
          <p className="note note--warning">
            Emoji artwork could not be loaded, so your system&apos;s emoji font was used. Check the
            preview before uploading.
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => void download()}
            disabled={busy}
            data-testid="download"
          >
            Download PNG
          </button>
          {canCopyImages() && (
            <button type="button" className="btn btn--block" onClick={copy}>
              Copy PNG to clipboard
            </button>
          )}
          <button type="button" className="btn btn--block" onClick={onShare}>
            Copy share link
          </button>
        </div>
      </div>
      <div className="section">
        <h2 className="section__title">Upload to Discord</h2>
        <div className="note">
          <ul>
            <li>Server Settings → Roles → pick a role → Display → Role Icon.</li>
            <li>Role icons need Server Boost level 2.</li>
            <li>At least 64×64 px, square, PNG or JPG, under 256 KB.</li>
            <li>Discord shows it at about 20 px, so keep shapes bold and simple.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
