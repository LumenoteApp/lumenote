import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import type { Song } from './midi';
import type { Settings } from './looks';
import { Renderer } from './render/Renderer';
import { renderSongAudio } from './audio/Piano';

export type ExportOptions = {
  width: number;
  height: number;
  fps: 30 | 60;
  audio: boolean;
  /** Only render this many seconds (for quick previews). */
  maxSeconds?: number;
  /** Start at this song time instead of the intro (for Shorts / highlights). */
  startAt?: number;
  /**
   * Use this audio instead of the built-in piano (e.g. a Pianoteq render).
   * Must be aligned to song time 0, like a WAV rendered from the same MIDI.
   */
  externalAudio?: AudioBuffer;
  /** Draw on top of each frame (titles, watermarks of your own...). Times in seconds. */
  overlay?: (g: CanvasRenderingContext2D, info: { songTime: number; videoTime: number; duration: number }) => void;
  onProgress?: (fraction: number, label: string) => void;
  signal?: AbortSignal;
};

/** Song time where the video starts / ends, so notes scroll in and ring out. */
export function exportWindow(song: Song, settings: Settings) {
  return { t0: song.first - settings.fall - 0.4, t1: song.end + 2.5 };
}

/** Start time of the `seconds`-long window with the most notes (for Shorts). */
export function busiestWindow(song: Song, seconds: number): number {
  const n = song.notes;
  if (song.end - song.first <= seconds) return song.first;
  let best = song.first;
  let bestCount = -1;
  let j = 0;
  for (let i = 0; i < n.length; i++) {
    while (j < n.length && n[j].start < n[i].start + seconds) j++;
    if (n[i].start + seconds > song.end) break;
    if (j - i > bestCount) {
      bestCount = j - i;
      best = n[i].start;
    }
  }
  return best;
}

/** Pick the visible key range: full piano for landscape, the song's range (+ margin) for portrait. */
export function keyRangeFor(song: Song | null, width: number, height: number): [number, number] {
  if (!song || width >= height * 1.2) return [21, 108];
  const span = Math.max(36, song.highest - song.lowest + 6);
  const mid = (song.highest + song.lowest) / 2;
  const lo = Math.max(21, Math.round(mid - span / 2));
  return [lo, Math.min(108, lo + span)];
}

/**
 * Offline export: every frame is rendered at an exact timestep, so the video is
 * perfectly smooth no matter how slow the machine is. H.264 first for maximum
 * compatibility (phones, WhatsApp, Instagram, YouTube).
 */
export async function exportVideo(song: Song, settings: Settings, opts: ExportOptions): Promise<Blob> {
  const { width, height, fps } = opts;
  const win = exportWindow(song, settings);
  const t0 = opts.startAt ?? win.t0;
  const fullEnd = win.t1;
  const t1 = opts.maxSeconds ? Math.min(fullEnd, t0 + opts.maxSeconds) : fullEnd;
  const duration = t1 - t0;
  const frames = Math.ceil(duration * fps);
  const report = opts.onProgress ?? (() => {});

  const canvas = document.createElement('canvas');
  const renderer = new Renderer(canvas, { preserve: true });
  renderer.resize(width, height);
  renderer.setSettings(settings);
  renderer.setSong(song);
  // Shorts: zoom to the keys actually used in this window, not the whole song.
  const inWindow = opts.startAt === undefined ? song : rangeOf(song, t0, t1);
  const [lo, hi] = keyRangeFor(inWindow, width, height);
  renderer.setKeyRange(lo, hi);

  const bitrate = Math.round(width * height * fps * 0.06);
  let codec: 'avc' | 'hevc' | 'vp9' | null = null;
  for (const c of ['avc', 'hevc', 'vp9'] as const) {
    if (await canEncodeVideo(c, { width, height, bitrate })) {
      codec = c;
      break;
    }
  }
  if (!codec) throw new Error('This browser cannot encode video. Try Chrome or Edge.');

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  // With an overlay, frames are composited onto a 2D canvas before encoding.
  let frameCanvas: HTMLCanvasElement = canvas;
  let g2: CanvasRenderingContext2D | null = null;
  if (opts.overlay) {
    frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    g2 = frameCanvas.getContext('2d')!;
  }
  const video = new CanvasSource(frameCanvas, { codec, bitrate, keyFrameInterval: 2, latencyMode: 'quality' });
  output.addVideoTrack(video, { frameRate: fps });

  let audio: AudioBufferSource | null = null;
  let audioBuffer: AudioBuffer | null = null;
  if (opts.audio) {
    report(0, 'Rendering piano audio');
    audioBuffer = opts.externalAudio
      ? sliceAudio(opts.externalAudio, t0, duration)
      : await renderSongAudio(song.notes, t0, duration, undefined, (f) =>
          report(f, `Rendering piano audio · ${Math.round(f * 100)}%`),
        );
    if (opts.startAt !== undefined) fadeEdges(audioBuffer, 0.4, 1.5);
    const aCodec = (await canEncodeAudio('aac')) ? 'aac' : (await canEncodeAudio('opus')) ? 'opus' : null;
    if (aCodec) {
      audio = new AudioBufferSource({ codec: aCodec, bitrate: QUALITY_HIGH });
      output.addAudioTrack(audio);
    }
  }

  await output.start();
  if (audio && audioBuffer) {
    await audio.add(audioBuffer);
    audio.close();
  }

  const dt = 1 / fps;
  // Starting mid-song: warm up sparks and glow so the first frame looks alive.
  if (opts.startAt !== undefined) for (let f = fps; f > 0; f--) renderer.frame(t0 - f * dt, dt);
  const started = performance.now();
  for (let f = 0; f < frames; f++) {
    if (opts.signal?.aborted) {
      await output.cancel();
      throw new DOMException('Export cancelled', 'AbortError');
    }
    renderer.frame(t0 + f * dt, dt);
    if (g2 && opts.overlay) {
      g2.drawImage(canvas, 0, 0);
      g2.save();
      opts.overlay(g2, { songTime: t0 + f * dt, videoTime: f * dt, duration });
      g2.restore();
    }
    await video.add(f * dt, dt);
    if (f % 15 === 0) {
      const el = (performance.now() - started) / 1000;
      const eta = f > 0 ? (el / f) * (frames - f) : 0;
      report(f / frames, `Frame ${f} / ${frames} · ${Math.ceil(eta)} s left`);
    }
  }
  video.close();
  report(1, 'Finishing file');
  await output.finalize();
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

function fadeEdges(buf: AudioBuffer, fadeIn: number, fadeOut: number) {
  const rate = buf.sampleRate;
  const a = Math.floor(fadeIn * rate);
  const b = Math.floor(fadeOut * rate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < a && i < d.length; i++) d[i] *= i / a;
    for (let i = 0; i < b && i < d.length; i++) d[d.length - 1 - i] *= i / b;
  }
}

function rangeOf(song: Song, from: number, to: number): Song {
  let lo = 127;
  let hi = 0;
  for (const n of song.notes) {
    if (n.start > to) break;
    if (n.end < from) continue;
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
  }
  return hi >= lo ? { ...song, lowest: lo, highest: hi } : song;
}

/** Cut [from, from + duration] out of a buffer that starts at song time 0 (pads with silence). */
function sliceAudio(src: AudioBuffer, from: number, duration: number): AudioBuffer {
  const rate = src.sampleRate;
  const length = Math.ceil(duration * rate);
  const out = new AudioBuffer({ length, numberOfChannels: src.numberOfChannels, sampleRate: rate });
  const start = Math.round(from * rate);
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const s = src.getChannelData(ch);
    const d = out.getChannelData(ch);
    const dstOff = Math.max(0, -start);
    const srcOff = Math.max(0, start);
    const n = Math.min(length - dstOff, s.length - srcOff);
    if (n > 0) d.set(s.subarray(srcOff, srcOff + n), dstOff);
  }
  return out;
}
