const MAX_DIMENSION = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The file could not be decoded as an image'));
    img.src = src;
  });
}

async function svgToObjectUrl(file: File): Promise<string> {
  let text = await file.text();
  if (!/<svg[^>]*\swidth=/.test(text)) {
    const viewBox = /viewBox="([^"]+)"/.exec(text)?.[1]?.split(/[\s,]+/).map(Number);
    const w = viewBox && viewBox.length === 4 && viewBox[2] ? viewBox[2] : MAX_DIMENSION;
    const h = viewBox && viewBox.length === 4 && viewBox[3] ? viewBox[3] : MAX_DIMENSION;
    const scale = MAX_DIMENSION / Math.max(w, h);
    text = text.replace(
      /<svg\b/,
      `<svg width="${Math.round(w * scale)}" height="${Math.round(h * scale)}"`,
    );
  }
  return URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
}

/**
 * Turns an uploaded image into a PNG data URL no larger than 1024px on its
 * longest side. GIFs are flattened to their first frame, SVGs are rasterized.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const url = isSvg ? await svgToObjectUrl(file) : URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const iw = image.naturalWidth || MAX_DIMENSION;
    const ih = image.naturalHeight || MAX_DIMENSION;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(iw, ih));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(iw * scale));
    canvas.height = Math.max(1, Math.round(ih * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
