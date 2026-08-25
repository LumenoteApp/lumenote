import type { StageImageFit, StageImageSettings } from '../midi/types';

export const DEFAULT_STAGE_IMAGE: StageImageSettings = {
  enabled: false,
  src: '',
  opacity: 0.85,
  fit: 'cover',
};

export function normalizeStageImage(
  partial?: Partial<StageImageSettings> | null,
): StageImageSettings {
  const p = partial ?? {};
  const opacity =
    typeof p.opacity === 'number' && Number.isFinite(p.opacity)
      ? Math.min(1, Math.max(0, p.opacity))
      : DEFAULT_STAGE_IMAGE.opacity;
  const fit: StageImageFit = p.fit === 'contain' ? 'contain' : 'cover';
  const src = typeof p.src === 'string' ? p.src : '';
  return {
    enabled: Boolean(p.enabled) && src.length > 0,
    src,
    opacity,
    fit,
  };
}

export function shouldPaintStageImage(img: StageImageSettings | null | undefined): boolean {
  if (!img) return false;
  return Boolean(img.enabled && img.src);
}

export function computeStageImageDest(
  viewW: number,
  viewH: number,
  imgW: number,
  imgH: number,
  fit: StageImageFit,
): { dx: number; dy: number; dw: number; dh: number } {
  if (!(viewW > 0) || !(viewH > 0) || !(imgW > 0) || !(imgH > 0)) {
    return { dx: 0, dy: 0, dw: Math.max(0, viewW), dh: Math.max(0, viewH) };
  }
  const scale =
    fit === 'contain' ? Math.min(viewW / imgW, viewH / imgH) : Math.max(viewW / imgW, viewH / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  return {
    dx: (viewW - dw) / 2,
    dy: (viewH - dh) / 2,
    dw,
    dh,
  };
}

type ImageLike = {
  naturalWidth?: number;
  naturalHeight?: number;
  width?: number;
  height?: number;
};

function imageSize(img: ImageLike): { w: number; h: number } {
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  return { w, h };
}

/**
 * Draw the user stage image into the shared visualizer canvas.
 * Returns true when a draw was attempted (settings active + image has size).
 */
export function paintUserStageImage(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  image: CanvasImageSource & ImageLike,
  settings: StageImageSettings,
): boolean {
  if (!shouldPaintStageImage(settings)) return false;
  const { w, h } = imageSize(image);
  if (!(w > 0) || !(h > 0)) return false;
  const dest = computeStageImageDest(viewW, viewH, w, h, settings.fit);
  ctx.save();
  ctx.globalAlpha = settings.opacity;
  ctx.drawImage(image, dest.dx, dest.dy, dest.dw, dest.dh);
  ctx.restore();
  return true;
}

const MAX_STAGE_IMAGE_EDGE = 1920;
const MAX_STAGE_IMAGE_BYTES = 2_500_000;

/** Compress a picked file into a data URL suitable for settings + localStorage. */
export async function fileToStageImageSrc(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_STAGE_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read image');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const quality = file.size > MAX_STAGE_IMAGE_BYTES ? 0.78 : 0.88;
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
