import { useRef, useState } from 'react';
import type { ExportSize, IconState, PreviewSettings } from '../../model/types';
import { ContentTab } from './ContentTab';
import { EffectsTab } from './EffectsTab';
import { ExportTab } from './ExportTab';
import { FillTab } from './FillTab';
import { ShapeTab } from './ShapeTab';
import type { IconUpdater } from './types';

const TABS = [
  { id: 'shape', label: 'Shape' },
  { id: 'fill', label: 'Fill' },
  { id: 'content', label: 'Content' },
  { id: 'effects', label: 'Effects' },
  { id: 'export', label: 'Export' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface ControlPanelProps {
  icon: IconState;
  updateIcon: IconUpdater;
  preview: PreviewSettings;
  exportSize: ExportSize;
  onExportSizeChange: (size: ExportSize) => void;
  onShare: () => void;
  notify: (message: string) => void;
}

export function ControlPanel({
  icon,
  updateIcon,
  preview,
  exportSize,
  onExportSizeChange,
  onShare,
  notify,
}: ControlPanelProps) {
  const [tab, setTab] = useState<TabId>('shape');
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    const target = TABS[next];
    if (!target) return;
    setTab(target.id);
    buttons.current[next]?.focus();
  };

  return (
    <aside className="panel" aria-label="Icon controls">
      <div className="tabs" role="tablist" aria-label="Editor sections" onKeyDown={onKeyDown}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'shape' && <ShapeTab icon={icon} updateIcon={updateIcon} />}
        {tab === 'fill' && <FillTab icon={icon} updateIcon={updateIcon} />}
        {tab === 'content' && <ContentTab icon={icon} updateIcon={updateIcon} notify={notify} />}
        {tab === 'effects' && <EffectsTab icon={icon} updateIcon={updateIcon} />}
        {tab === 'export' && (
          <ExportTab
            icon={icon}
            preview={preview}
            size={exportSize}
            onSizeChange={onExportSizeChange}
            onShare={onShare}
            notify={notify}
          />
        )}
      </div>
    </aside>
  );
}
