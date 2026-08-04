/**
 * Video export helpers.
 * - Realtime: canvas.captureStream + MediaRecorder (can drop frames under load)
 * - Bake: offline stepped frames via offlineBake.ts (smooth, frame-perfect timing)
 */

export type ExportFps = 30 | 60;

/** bake = offline smooth; realtime = live MediaRecorder capture */
export type ExportMode = 'bake' | 'realtime';

/** Logical layout size for all export resolutions (composition is scaled to output). */
export const EXPORT_DESIGN = { width: 1920, height: 1080 } as const;

export type ExportPresetId = '720p' | '1080p' | '1440p' | '4k';

export type ExportPreset = {
  id: ExportPresetId;
  /** Short button label */
  label: string;
  width: number;
  height: number;
};

/** 16:9 presets through 4K UHD */
export const EXPORT_PRESETS: readonly ExportPreset[] = [
  { id: '720p', label: '720p', width: 1280, height: 720 },
  { id: '1080p', label: '1080p', width: 1920, height: 1080 },
  { id: '1440p', label: '1440p', width: 2560, height: 1440 },
  { id: '4k', label: '4K', width: 3840, height: 2160 },
] as const;

export function findExportPreset(width: number, height: number): ExportPreset | undefined {
  return EXPORT_PRESETS.find((p) => p.width === width && p.height === height);
}

export function formatResolution(width: number, height: number): string {
  const preset = findExportPreset(width, height);
  return preset ? `${preset.label} (${width}×${height})` : `${width}×${height}`;
}

export type ExportSettings = {
  width: number;
  height: number;
  fps: ExportFps;
  includeAudio: boolean;
  mode: ExportMode;
};

export type ExportProgress = {
  phase: 'idle' | 'preparing' | 'recording' | 'finalizing' | 'done' | 'error' | 'cancelled';
  /** Song time / bake progress */
  elapsed: number;
  duration: number;
  message?: string;
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  includeAudio: true,
  mode: 'bake',
};

/** WebCodecs available - required for smooth offline bake */
export function canBakeOffline(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export function exportExtension(mime: string | undefined): string {
  if (mime?.includes('mp4')) return 'mp4';
  return 'webm';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has a chance to start the download
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function videoBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  // Rough targets: 720p30 ~5, 1080p30 ~10, 1440p30 ~16, 4K30 ~35 Mbps
  let base: number;
  if (pixels >= 3840 * 2160) base = 35_000_000;
  else if (pixels >= 2560 * 1440) base = 16_000_000;
  else if (pixels >= 1920 * 1080) base = 10_000_000;
  else base = 5_000_000;
  return Math.round(base * (fps >= 60 ? 1.5 : 1));
}

export class VideoExporter {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime: string | undefined;
  private cancelled = false;
  private stopPromise: Promise<Blob> | null = null;

  get supported() {
    return typeof MediaRecorder !== 'undefined' && !!pickRecorderMime();
  }

  isRecording() {
    return this.recorder?.state === 'recording';
  }

  /**
   * Start capturing canvas (+ optional audio tracks from Web Audio).
   * Canvas bitmap size should already be set to export resolution.
   */
  start(opts: {
    canvas: HTMLCanvasElement;
    audioStream?: MediaStream | null;
    fps: ExportFps;
    width: number;
    height: number;
    includeAudio: boolean;
  }): void {
    if (this.recorder) {
      throw new Error('Export already in progress');
    }
    this.cancelled = false;
    this.chunks = [];
    this.mime = pickRecorderMime();
    if (!this.mime && typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    const fps = opts.fps;
    // captureStream frame rate hint (browser may drop frames under load)
    const canvasStream =
      typeof opts.canvas.captureStream === 'function'
        ? opts.canvas.captureStream(fps)
        : null;
    if (!canvasStream) {
      throw new Error('canvas.captureStream is not supported');
    }

    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    if (opts.includeAudio && opts.audioStream) {
      for (const t of opts.audioStream.getAudioTracks()) {
        tracks.push(t);
      }
    }

    const combined = new MediaStream(tracks);
    const init: MediaRecorderOptions = {
      videoBitsPerSecond: videoBitrate(opts.width, opts.height, fps),
    };
    if (this.mime) init.mimeType = this.mime;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combined, init);
    } catch {
      // Retry without mimeType / bitrate if the browser rejects options
      recorder = new MediaRecorder(combined);
    }

    this.recorder = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    // Timeslice keeps memory bounded on long songs
    recorder.start(500);
  }

  /** Stop and return the recorded blob (or empty if cancelled with no data). */
  stop(): Promise<Blob> {
    if (this.stopPromise) return this.stopPromise;

    const rec = this.recorder;
    if (!rec || rec.state === 'inactive') {
      const blob = new Blob(this.chunks, {
        type: this.mime ?? 'video/webm',
      });
      this.cleanup();
      return Promise.resolve(blob);
    }

    this.stopPromise = new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => {
        try {
          const blob = new Blob(this.chunks, {
            type: rec.mimeType || this.mime || 'video/webm',
          });
          this.cleanup();
          resolve(blob);
        } catch (e) {
          this.cleanup();
          reject(e);
        }
      };
      rec.onerror = () => {
        this.cleanup();
        reject(new Error('MediaRecorder failed'));
      };
      try {
        rec.stop();
      } catch (e) {
        this.cleanup();
        reject(e);
      }
    });

    return this.stopPromise;
  }

  cancel() {
    this.cancelled = true;
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.cleanup();
  }

  wasCancelled() {
    return this.cancelled;
  }

  private cleanup() {
    this.recorder = null;
    this.stopPromise = null;
    this.chunks = [];
  }
}

/** Wait until playback leaves 'playing' (end of song / pause / stop). */
export function waitForPlaybackIdle(
  getState: () => string,
  subscribe: (fn: () => void) => () => void,
): Promise<void> {
  return new Promise((resolve) => {
    if (getState() !== 'playing') {
      resolve();
      return;
    }
    const unsub = subscribe(() => {
      if (getState() !== 'playing') {
        unsub();
        resolve();
      }
    });
  });
}

export function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

export function sanitizeFilename(name: string): string {
  const base = name.replace(/\.(mid|midi)$/i, '').trim() || 'lumenote';
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80);
}
