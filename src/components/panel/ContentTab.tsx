import { DEFAULT_ICON, defaultContent } from '../../model/defaults';
import { RANGES, type Content, type ContentKind } from '../../model/types';
import { EmojiPicker } from '../content/EmojiPicker';
import { ImageUpload } from '../content/ImageUpload';
import { SymbolPicker } from '../content/SymbolPicker';
import { TextControls } from '../content/TextControls';
import { ColorField } from '../controls/ColorField';
import { Segmented } from '../controls/Segmented';
import { Slider, degrees, percent, signedPercent } from '../controls/Slider';
import { Toggle } from '../controls/Toggle';
import type { TabProps } from './types';

const KIND_OPTIONS: ReadonlyArray<{ value: ContentKind; label: string }> = [
  { value: 'emoji', label: 'Emoji' },
  { value: 'text', label: 'Text' },
  { value: 'symbol', label: 'Symbol' },
  { value: 'image', label: 'Image' },
  { value: 'none', label: 'None' },
];

interface ContentTabProps extends TabProps {
  notify: (message: string) => void;
}

export function ContentTab({ icon, updateIcon, notify }: ContentTabProps) {
  const { content, transform } = icon;

  const patchKind = <K extends Content['kind']>(
    kind: K,
    mutate: (content: Extract<Content, { kind: K }>) => void,
  ) =>
    updateIcon((draft) => {
      if (draft.content.kind === kind) mutate(draft.content as Extract<Content, { kind: K }>);
    });

  return (
    <>
      <div className="section">
        <h2 className="section__title">Content</h2>
        <Segmented
          label="Content type"
          hideLabel
          options={KIND_OPTIONS}
          value={content.kind}
          onChange={(kind) =>
            updateIcon((draft) => {
              if (draft.content.kind !== kind) draft.content = defaultContent(kind, draft.content);
            })
          }
        />
        {content.kind === 'emoji' && (
          <EmojiPicker
            value={content.emoji}
            onChange={(emoji) =>
              patchKind('emoji', (c) => {
                c.emoji = emoji;
              })
            }
          />
        )}
        {content.kind === 'text' && (
          <TextControls content={content} patch={(mutate) => patchKind('text', mutate)} />
        )}
        {content.kind === 'symbol' && (
          <>
            <SymbolPicker
              value={content.symbol}
              onChange={(symbol) =>
                patchKind('symbol', (c) => {
                  c.symbol = symbol;
                })
              }
            />
            <ColorField
              label="Symbol color"
              value={content.color}
              onChange={(hex) =>
                patchKind('symbol', (c) => {
                  c.color = hex;
                })
              }
            />
          </>
        )}
        {content.kind === 'image' && (
          <ImageUpload
            content={content}
            hasShape={icon.shape !== 'none'}
            patch={(mutate) => patchKind('image', mutate)}
            notify={notify}
          />
        )}
        {content.kind === 'none' && (
          <p className="note">Just the background shape. Handy for plain color dots.</p>
        )}
      </div>
      {content.kind !== 'none' && (
        <div className="section">
          <h2 className="section__title">
            Placement
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() =>
                updateIcon((draft) => {
                  draft.transform = { ...DEFAULT_ICON.transform };
                })
              }
            >
              Reset
            </button>
          </h2>
          <Slider
            label="Size"
            value={transform.scale}
            range={RANGES.scale}
            format={percent}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.transform.scale = value;
              })
            }
          />
          <Slider
            label="Horizontal offset"
            value={transform.x}
            range={RANGES.offset}
            format={signedPercent}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.transform.x = value;
              })
            }
          />
          <Slider
            label="Vertical offset"
            value={transform.y}
            range={RANGES.offset}
            format={signedPercent}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.transform.y = value;
              })
            }
          />
          <Slider
            label="Rotation"
            value={transform.rotation}
            range={RANGES.rotation}
            format={degrees}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.transform.rotation = value;
              })
            }
          />
          <Slider
            label="Opacity"
            value={transform.opacity}
            range={RANGES.opacity}
            format={percent}
            onChange={(value) =>
              updateIcon((draft) => {
                draft.transform.opacity = value;
              })
            }
          />
          {'shadow' in content && (
            <Toggle
              label="Content shadow"
              checked={content.shadow}
              onChange={(checked) =>
                updateIcon((draft) => {
                  if ('shadow' in draft.content) draft.content.shadow = checked;
                })
              }
            />
          )}
        </div>
      )}
    </>
  );
}
