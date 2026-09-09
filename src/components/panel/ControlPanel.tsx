import { useRef } from 'react';
import type { Idea } from '../../assistant/generate';
import type { ExportSize, IconState, PreviewSettings } from '../../model/types';
import { AssistantTab } from './AssistantTab';
import { LayersTab } from './LayersTab';
import { EffectsTab } from './EffectsTab';
import { ExportTab } from './ExportTab';
import { FillTab } from './FillTab';
import { ShapeTab } from './ShapeTab';
import type { IconUpdater } from './types';

const TABS = [
  { id: 'ai', label: '✨ AI' },
  { id: 'shape', label: 'Shape' },
  { id: 'fill', label: 'Fill' },
  { id: 'layers', label: 'Layers' },
  { id: 'effects', label: 'Effects' },
  { id: 'export', label: 'Export' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

interface ControlPanelProps {
  tab: TabId;
  onTabChange: (tab: TabId) => void;
  icon: IconState;
  updateIcon: IconUpdater;
  setIcon: (next: IconState) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  assistantFocusToken: number;
  onApplyIdea: (idea: Idea) => void;
  onApplyIcon: (icon: IconState, roleName?: string) => void;
  preview: PreviewSettings;
  exportSize: ExportSize;
  onExportSizeChange: (size: ExportSize) => void;
  onShare: () => void;
  notify: (message: string) => void;
}

export function ControlPanel({
  tab,
  onTabChange,
  icon,
  updateIcon,
  setIcon,
  selectedLayerId,
  onSelectLayer,
  assistantFocusToken,
  onApplyIdea,
  onApplyIcon,
  preview,
  exportSize,
  onExportSizeChange,
  onShare,
  notify,
}: ControlPanelProps) {
  const setTab = onTabChange;
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
        {tab === 'ai' && (
          <AssistantTab
            icon={icon}
            focusToken={assistantFocusToken}
            onApplyIdea={onApplyIdea}
            onApplyIcon={onApplyIcon}
          />
        )}
        {tab === 'shape' && <ShapeTab icon={icon} updateIcon={updateIcon} />}
        {tab === 'fill' && <FillTab icon={icon} updateIcon={updateIcon} />}
        {tab === 'layers' && (
          <LayersTab
            icon={icon}
            updateIcon={updateIcon}
            setIcon={setIcon}
            selectedLayerId={selectedLayerId}
            onSelectLayer={onSelectLayer}
            notify={notify}
          />
        )}
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
