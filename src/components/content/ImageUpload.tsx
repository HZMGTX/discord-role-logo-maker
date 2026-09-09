import { useRef, useState, type DragEvent } from 'react';
import { imageFileToDataUrl } from '../../export/imageFile';
import { IMAGE_FITS, type Content, type ImageFit } from '../../model/types';
import { Segmented } from '../controls/Segmented';

type ImageContent = Extract<Content, { kind: 'image' }>;

interface ImageUploadProps {
  content: ImageContent;
  patch: (mutate: (content: ImageContent) => void) => void;
  notify: (message: string) => void;
}

const FIT_OPTIONS: ReadonlyArray<{ value: ImageFit; label: string }> = IMAGE_FITS.map((fit) => ({
  value: fit,
  label: fit === 'cover' ? 'Fill' : 'Fit inside',
}));

export function ImageUpload({ content, patch, notify }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.svg$/i.test(file.name)) {
      notify('Please choose an image file');
      return;
    }
    setBusy(true);
    try {
      const src = await imageFileToDataUrl(file);
      patch((c) => {
        c.src = src;
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read that image');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void accept(event.dataTransfer.files[0]);
  };

  return (
    <>
      <div
        className={`dropzone${dragging ? ' dropzone--active' : ''}`}
        role="button"
        tabIndex={0}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {content.src ? (
          <>
            <img src={content.src} alt="Uploaded image preview" />
            <span>Click or drop to replace</span>
          </>
        ) : (
          <>
            <strong>{busy ? 'Reading image…' : 'Drop an image here'}</strong>
            <span>PNG, JPG, GIF, WebP or SVG. Stays in your browser.</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.svg"
          className="visually-hidden"
          tabIndex={-1}
          onChange={(event) => {
            void accept(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {content.src && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={() =>
            patch((c) => {
              c.src = null;
            })
          }
        >
          Remove image
        </button>
      )}
      <Segmented
        label="Sizing"
        options={FIT_OPTIONS}
        value={content.fit}
        onChange={(value) =>
          patch((c) => {
            c.fit = value;
          })
        }
      />
    </>
  );
}
