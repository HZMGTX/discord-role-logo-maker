type ImageStatus = 'loading' | 'ready' | 'error';
type FontStatus = 'loading' | 'loaded' | 'missing';
type Listener = () => void;

interface ImageEntry {
  status: ImageStatus;
  image: HTMLImageElement | null;
}

const hasDocument = typeof document !== 'undefined';

/**
 * Loads and caches the images (emoji art, uploads) and fonts the renderer needs.
 * Loading is lazy: the renderer asks for a resource, gets `null` while it is on
 * its way, and every subscriber is notified (via `version`) when it arrives.
 */
class ResourceCache {
  version = 0;
  private images = new Map<string, ImageEntry>();
  private fonts = new Map<string, FontStatus>();
  private listeners = new Set<Listener>();
  private pending = 0;
  private idleWaiters: Array<() => void> = [];

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  get isIdle(): boolean {
    return this.pending === 0;
  }

  /** Resolves once every resource requested so far has loaded or failed. */
  whenIdle(): Promise<void> {
    if (this.pending === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  imageStatus(url: string): ImageStatus | 'idle' {
    return this.images.get(url)?.status ?? 'idle';
  }

  /** The image when it is ready; otherwise starts loading it (once) and returns null. */
  getImage(url: string): HTMLImageElement | null {
    const entry = this.images.get(url);
    if (entry) return entry.status === 'ready' ? entry.image : null;
    this.images.set(url, { status: 'loading', image: null });
    this.begin();
    void this.load(url).then(
      (image) => {
        this.images.set(url, { status: 'ready', image });
        this.end();
      },
      () => {
        this.images.set(url, { status: 'error', image: null });
        this.end();
      },
    );
    return null;
  }

  /** True when the font can be drawn with (loaded, or not available at all); false while loading. */
  ensureFont(spec: string): boolean {
    if (!hasDocument || !('fonts' in document)) return true;
    const status = this.fonts.get(spec);
    if (status === 'loaded' || status === 'missing') return true;
    if (status === 'loading') return false;
    if (document.fonts.check(spec)) {
      this.fonts.set(spec, 'loaded');
      return true;
    }
    this.fonts.set(spec, 'loading');
    this.begin();
    document.fonts.load(spec).then(
      (faces) => {
        this.fonts.set(spec, faces.length > 0 ? 'loaded' : 'missing');
        this.end();
      },
      () => {
        this.fonts.set(spec, 'missing');
        this.end();
      },
    );
    return false;
  }

  private async load(url: string): Promise<HTMLImageElement> {
    const src = /^https?:/.test(url) ? await toSameOriginUrl(url) : url;
    return loadImage(src);
  }

  private begin(): void {
    this.pending += 1;
  }

  private end(): void {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      for (const resolve of waiters) resolve();
    }
    this.bump();
  }

  private bump(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}

/**
 * Fetches a remote image and re-serves it from a same-origin blob: URL so the
 * canvas never gets tainted. SVGs without an intrinsic size get one, because
 * Firefox draws nothing for them otherwise.
 */
async function toSameOriginUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('svg')) {
    return URL.createObjectURL(await response.blob());
  }
  let text = await response.text();
  if (!/<svg[^>]*\swidth=/.test(text)) {
    text = text.replace(/<svg\b/, '<svg width="512" height="512"');
  }
  return URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image ${src.slice(0, 80)}`));
    img.src = src;
  });
}

export const resources = new ResourceCache();
