export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
  preferWebP?: boolean;
}

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  sizeBytes: number;
  originalSizeBytes: number;
  mimeType: 'image/webp' | 'image/jpeg' | 'image/svg+xml';
  width: number;
  height: number;
  wasCompressed: boolean;
}

const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_MAX_HEIGHT = 800;
const DEFAULT_QUALITY = 0.72;
const DEFAULT_MAX_SIZE_BYTES = 75 * 1024; // < 80 Ko strictement

export function estimateDataUrlBytes(dataUrl: string): number {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const header = dataUrl.slice(0, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  if (/;base64/i.test(header)) {
    const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  return payload.length;
}

export function isHeavyBase64Image(
  src?: string | null,
  thresholdBytes = 35 * 1024
): boolean {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed.startsWith('data:image/')) return false;
  if (/^data:image\/svg\+xml/i.test(trimmed)) return false;
  const bytes = estimateDataUrlBytes(trimmed);
  // Compresser toute image Base64 > 35 Ko ou tout format non-WebP > 12 Ko
  const isWebP = /^data:image\/webp/i.test(trimmed);
  return bytes > thresholdBytes || (!isWebP && bytes > 12 * 1024);
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire les données image.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de décoder l’image sélectionnée.'));
    img.src = src;
  });
}

function encodeCanvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    } catch {
      resolve(null);
    }
  });
}

async function encodeWithTargetSize(
  sourceImg: HTMLImageElement,
  options: Required<ImageCompressionOptions>
): Promise<{
  blob: Blob;
  mimeType: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
}> {
  const naturalW = sourceImg.naturalWidth || sourceImg.width || options.maxWidth;
  const naturalH = sourceImg.naturalHeight || sourceImg.height || options.maxHeight;

  const initialRatio = Math.min(
    1,
    options.maxWidth / Math.max(1, naturalW),
    options.maxHeight / Math.max(1, naturalH)
  );

  let targetW = Math.max(1, Math.round(naturalW * initialRatio));
  let targetH = Math.max(1, Math.round(naturalH * initialRatio));

  const renderAt = async (
    w: number,
    h: number,
    mime: 'image/webp' | 'image/jpeg',
    q: number
  ): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(sourceImg, 0, 0, w, h);
    const blob = await encodeCanvasToBlob(canvas, mime, q);
    if (!blob || blob.type !== mime) {
      return null;
    }
    return blob;
  };

  let activeMime: 'image/webp' | 'image/jpeg' = options.preferWebP ? 'image/webp' : 'image/jpeg';
  let bestBlob = await renderAt(targetW, targetH, activeMime, options.quality);
  if (!bestBlob && activeMime === 'image/webp') {
    activeMime = 'image/jpeg';
    bestBlob = await renderAt(targetW, targetH, activeMime, options.quality);
  }
  if (!bestBlob) {
    throw new Error('Compression canvas indisponible dans ce navigateur.');
  }

  let bestW = targetW;
  let bestH = targetH;

  // Étapes progressives si la taille dépasse encore maxSizeBytes (ex. 75 Ko)
  const qualitySteps = [
    Math.min(options.quality, 0.65),
    0.56,
    0.46
  ];
  for (const q of qualitySteps) {
    if (bestBlob.size <= options.maxSizeBytes) break;
    const candidate = await renderAt(bestW, bestH, activeMime, q);
    if (candidate && candidate.size < bestBlob.size) {
      bestBlob = candidate;
    }
  }

  // Réduction supplémentaire des dimensions si nécessaire pour images très détaillées
  const dimensionFactors = [0.8, 0.65];
  for (const factor of dimensionFactors) {
    if (bestBlob.size <= options.maxSizeBytes) break;
    const nextW = Math.max(240, Math.round(targetW * factor));
    const nextH = Math.max(240, Math.round(targetH * factor));
    const candidate = await renderAt(nextW, nextH, activeMime, 0.55);
    if (candidate && candidate.size < bestBlob.size) {
      bestBlob = candidate;
      bestW = nextW;
      bestH = nextH;
    }
  }

  return {
    blob: bestBlob,
    mimeType: activeMime,
    width: bestW,
    height: bestH
  };
}

function replaceExtension(filename: string, mimeType: 'image/webp' | 'image/jpeg'): string {
  const base = filename.replace(/\.[^/.]+$/, '') || 'image';
  return `${base}.${mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
}

export async function compressImageFile(
  file: File,
  customOptions: ImageCompressionOptions = {}
): Promise<CompressedImageResult> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    const dataUrl = await readBlobAsDataUrl(file);
    return {
      file,
      dataUrl,
      sizeBytes: file.size,
      originalSizeBytes: file.size,
      mimeType: 'image/jpeg',
      width: 0,
      height: 0,
      wasCompressed: false
    };
  }

  if (file.type === 'image/svg+xml') {
    const dataUrl = await readBlobAsDataUrl(file);
    return {
      file,
      dataUrl,
      sizeBytes: file.size,
      originalSizeBytes: file.size,
      mimeType: 'image/svg+xml',
      width: 0,
      height: 0,
      wasCompressed: false
    };
  }

  const options: Required<ImageCompressionOptions> = {
    maxWidth: customOptions.maxWidth ?? DEFAULT_MAX_WIDTH,
    maxHeight: customOptions.maxHeight ?? DEFAULT_MAX_HEIGHT,
    quality: customOptions.quality ?? DEFAULT_QUALITY,
    maxSizeBytes: customOptions.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES,
    preferWebP: customOptions.preferWebP ?? true
  };

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;

    // Si déjà WebP ou JPEG très léger et aux bonnes dimensions, inutile de dégrader davantage
    if (
      (file.type === 'image/webp' || file.type === 'image/jpeg') &&
      file.size <= Math.min(35 * 1024, options.maxSizeBytes) &&
      naturalW <= options.maxWidth &&
      naturalH <= options.maxHeight
    ) {
      const dataUrl = await readBlobAsDataUrl(file);
      return {
        file,
        dataUrl,
        sizeBytes: file.size,
        originalSizeBytes: file.size,
        mimeType: file.type,
        width: naturalW,
        height: naturalH,
        wasCompressed: false
      };
    }

    const encoded = await encodeWithTargetSize(img, options);
    const outFile = new File(
      [encoded.blob],
      replaceExtension(file.name, encoded.mimeType),
      { type: encoded.mimeType, lastModified: Date.now() }
    );
    const dataUrl = await readBlobAsDataUrl(encoded.blob);
    return {
      file: outFile,
      dataUrl,
      sizeBytes: encoded.blob.size,
      originalSizeBytes: file.size,
      mimeType: encoded.mimeType,
      width: encoded.width,
      height: encoded.height,
      wasCompressed: true
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImageSourceToFile(
  src: string,
  filenameBase = 'image',
  customOptions: ImageCompressionOptions = {}
): Promise<CompressedImageResult | null> {
  if (typeof document === 'undefined' || !src || /^data:image\/svg\+xml/i.test(src)) {
    return null;
  }

  const options: Required<ImageCompressionOptions> = {
    maxWidth: customOptions.maxWidth ?? DEFAULT_MAX_WIDTH,
    maxHeight: customOptions.maxHeight ?? DEFAULT_MAX_HEIGHT,
    quality: customOptions.quality ?? DEFAULT_QUALITY,
    maxSizeBytes: customOptions.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES,
    preferWebP: customOptions.preferWebP ?? true
  };

  const originalSizeBytes = src.startsWith('data:') ? estimateDataUrlBytes(src) : 0;

  try {
    const img = await loadImageElement(src);
    const encoded = await encodeWithTargetSize(img, options);
    const outFile = new File(
      [encoded.blob],
      `${filenameBase}.${encoded.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
      { type: encoded.mimeType, lastModified: Date.now() }
    );
    const dataUrl = await readBlobAsDataUrl(encoded.blob);
    return {
      file: outFile,
      dataUrl,
      sizeBytes: encoded.blob.size,
      originalSizeBytes: originalSizeBytes || encoded.blob.size,
      mimeType: encoded.mimeType,
      width: encoded.width,
      height: encoded.height,
      wasCompressed: true
    };
  } catch {
    return null;
  }
}

export async function compressImageDataUrl(
  dataUrl: string,
  customOptions: ImageCompressionOptions = {}
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || /^data:image\/svg\+xml/i.test(dataUrl)) {
    return dataUrl;
  }
  const result = await compressImageSourceToFile(dataUrl, 'csv-image', customOptions);
  if (!result) return dataUrl;
  const origBytes = estimateDataUrlBytes(dataUrl);
  if (origBytes > 0 && result.sizeBytes >= origBytes && origBytes <= (customOptions.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES)) {
    return dataUrl;
  }
  return result.dataUrl;
}
