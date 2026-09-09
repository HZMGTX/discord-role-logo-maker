type ImageStatus = 'loading' | 'ready' | 'error';
type FontStatus = 'loading' | 'loaded' | 'missing';
type SheetStatus = 'loading' | 'ready' | 'error';
type Listener = () => void;

/** Families already linked from index.html; they need no extra stylesheet. */
const BUNDLED_FAMILIES = new Set(
  [
    'Inter',
    'Rubik',
    'Bangers',
    'Luckiest Guy',
    'Press Start 2P',
    'Pacifico',
    'Black Ops One',
    'Bebas Neue',
    'Lobster',
  ].map((f) => f.toLowerCase()),
);

/** "Comic Neue" -> "Comic+Neue:wght@400;700;900" for the Google Fonts CSS API. */
function googleFamilyParam(family: string): string {
  const name = family.trim().replace(/\s+/g, ' ');
  return `${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700;900`;
}

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
  private sheets = new Map<string, SheetStatus>();
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

  /**
   * Pulls a Google Fonts stylesheet in for a family that index.html does not
   * preload. Returns false while the stylesheet is still on its way, so the
   * renderer waits instead of drawing the fallback face.
   */
  private ensureFontStylesheet(family: string): boolean {
    const key = family.trim().toLowerCase();
    if (!key || BUNDLED_FAMILIES.has(key)) return true;
    if (!hasDocument) return true;
    const status = this.sheets.get(key);
    if (status === 'ready' || status === 'error') return true;
    if (status === 'loading') return false;
    this.sheets.set(key, 'loading');
    this.begin();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${googleFamilyParam(family)}&display=swap`;
    const settle = (next: SheetStatus) => {
      if (this.sheets.get(key) !== 'loading') return;
      this.sheets.set(key, next);
      this.end();
    };
    link.addEventListener('load', () => settle('ready'), { once: true });
    link.addEventListener('error', () => settle('error'), { once: true });
    document.head.appendChild(link);
    return false;
  }

  /**
   * True when text can be drawn in `family`. Any family name works: one that
   * index.html does not preload is fetched from Google Fonts on demand, so the
   * font list is not a limit.
   */
  ensureFontFamily(family: string, weight = 400): boolean {
    if (!this.ensureFontStylesheet(family)) return false;
    return this.ensureFont(`${weight} 32px "${family}"`);
  }

  /** Whether a dynamically requested family turned out to be unavailable. */
  fontFamilyMissing(family: string, weight = 400): boolean {
    const key = family.trim().toLowerCase();
    if (this.sheets.get(key) === 'error') return true;
    return this.fonts.get(`${weight} 32px "${family}"`) === 'missing';
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
