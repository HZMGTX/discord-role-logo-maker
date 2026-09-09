import { useCallback, useEffect, useState } from 'react';
import type { Idea } from './assistant/generate';
import { Toast, useToast } from './components/Toast';
import { Header } from './components/layout/Header';
import { ControlPanel, type TabId } from './components/panel/ControlPanel';
import { PresetGallery } from './components/presets/PresetGallery';
import { ChatMock, MemberListMock } from './components/preview/DiscordMocks';
import { PreviewSettingsBar } from './components/preview/PreviewSettingsBar';
import { PreviewStage } from './components/preview/PreviewStage';
import { downloadBlob, formatBytes, renderToBlob } from './export/exportPng';
import { loadInitialState } from './hooks/initialState';
import { useIconDataUrl } from './hooks/useIconDataUrl';
import { usePersistedState } from './hooks/usePersistedState';
import { DEFAULT_ICON, DEFAULT_PREVIEW, cloneIcon } from './model/defaults';
import type { Preset } from './model/presets';
import { randomizeIcon } from './model/random';
import { buildShareHash, encodeShare } from './model/serialize';
import { exportFilename } from './model/slug';
import type { ExportSize, IconState, PreviewSettings } from './model/types';

const REPO_URL = 'https://github.com/HZMGTX/discord-role-logo-maker';

function clearHash() {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export function App() {
  const [initial] = useState(loadInitialState);
  const [icon, setIcon] = useState<IconState>(initial.icon);
  const [preview, setPreview] = useState<PreviewSettings>(initial.preview);
  const [exportSize, setExportSize] = useState<ExportSize>(256);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabId>('ai');
  const [assistantFocusToken, setAssistantFocusToken] = useState(0);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const { toast, notify } = useToast();
  const iconUrl = useIconDataUrl(icon, 64);

  usePersistedState(icon, preview);

  useEffect(() => {
    if (initial.source === 'share') notify('Loaded the design from your share link');
  }, [initial.source, notify]);

  const replaceIcon = useCallback((next: IconState) => {
    clearHash();
    setIcon(next);
  }, []);

  const updateIcon = useCallback((mutate: (draft: IconState) => void) => {
    clearHash();
    setIcon((current) => {
      const next = structuredClone(current);
      mutate(next);
      return next;
    });
  }, []);

  const updatePreview = useCallback((patch: Partial<PreviewSettings>) => {
    clearHash();
    setPreview((current) => ({ ...current, ...patch }));
  }, []);

  const applyPreset = (preset: Preset) => {
    clearHash();
    setIcon(cloneIcon(preset.icon));
    setPreview((current) => ({ ...current, roleName: preset.name, roleColor: preset.roleColor }));
    notify(`Loaded the ${preset.name} preset`);
  };

  const randomize = () => {
    clearHash();
    setIcon(randomizeIcon());
  };

  const askAi = () => {
    setTab('ai');
    setAssistantFocusToken((token) => token + 1);
  };

  const applyIdea = useCallback((idea: Idea) => {
    clearHash();
    setIcon(cloneIcon(idea.icon));
    setPreview((current) => ({
      ...current,
      roleName: idea.roleName ?? current.roleName,
      roleColor: idea.roleColor,
    }));
  }, []);

  const applyIcon = useCallback((next: IconState, roleName?: string) => {
    clearHash();
    setIcon(next);
    if (roleName) setPreview((current) => ({ ...current, roleName }));
  }, []);

  const reset = () => {
    clearHash();
    setIcon(cloneIcon(DEFAULT_ICON));
    setPreview({ ...DEFAULT_PREVIEW });
    notify('Back to the default design');
  };

  const share = async () => {
    const hash = buildShareHash(encodeShare(icon, preview));
    window.history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify(
        icon.layers.some((l) => l.content.kind === 'image' && l.content.src)
          ? 'Link copied (uploaded images are not included)'
          : 'Share link copied',
      );
    } catch {
      notify('The share link is in the address bar');
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const { blob, bytes } = await renderToBlob(icon, exportSize);
      downloadBlob(blob, exportFilename(preview.roleName, exportSize));
      notify(`Downloaded ${exportSize}×${exportSize} PNG (${formatBytes(bytes)})`);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <Header onAskAi={askAi} onRandomize={randomize} onReset={reset} onShare={() => void share()} />
      <main className="main">
        <ControlPanel
          tab={tab}
          onTabChange={setTab}
          icon={icon}
          updateIcon={updateIcon}
          setIcon={replaceIcon}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          assistantFocusToken={assistantFocusToken}
          onApplyIdea={applyIdea}
          onApplyIcon={applyIcon}
          preview={preview}
          exportSize={exportSize}
          onExportSizeChange={setExportSize}
          onShare={() => void share()}
          notify={notify}
        />
        <section className="stage" aria-label="Preview">
          <div className="stage__row">
            <PreviewStage
              icon={icon}
              iconUrl={iconUrl}
              exportSize={exportSize}
              onDownload={() => void download()}
              busy={busy}
            />
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">In Discord</h2>
                <span className="card__hint">how members will see it</span>
              </div>
              <div className="mocks">
                <ChatMock theme="dark" iconUrl={iconUrl} preview={preview} />
                <MemberListMock theme="dark" iconUrl={iconUrl} preview={preview} />
                <ChatMock theme="light" iconUrl={iconUrl} preview={preview} />
                <MemberListMock theme="light" iconUrl={iconUrl} preview={preview} />
              </div>
              <PreviewSettingsBar preview={preview} onChange={updatePreview} />
            </div>
          </div>
          <PresetGallery onSelect={applyPreset} />
        </section>
      </main>
      <footer className="footer">
        <span>
          Not affiliated with Discord Inc. Discord is a trademark of Discord Inc.
        </span>
        <span>
          Emoji artwork by <a href="https://github.com/jdecked/twemoji">Twemoji</a> (CC-BY 4.0) ·{' '}
          <a href={REPO_URL}>Source on GitHub</a>
        </span>
      </footer>
      <Toast toast={toast} />
    </div>
  );
}
