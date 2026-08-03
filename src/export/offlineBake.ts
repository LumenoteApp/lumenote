/**
 * Offline stepped-frame video bake — every frame is drawn at fixed dt (1/fps).
 * No realtime capture, so no dropped frames from machine load.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
  canEncodeVideo,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type AudioCodec,
  type VideoCodec,
} from 'mediabunny';
import type { Song, TrackInfo, VisualSettings } from '../midi/types';
import type { InstrumentId } from '../engine/instruments';
import {
  createToneInstrument,
  getInstrumentInfo,
  type BuiltinInstrumentId,
} from '../engine/instruments';
import { VisualizerEngine } from '../render/VisualizerEngine';
import type { ExportFps, ExportProgress } from './VideoExporter';

export type BakeOptions = {
  song: Song;
  tracks: TrackInfo[];
  settings: VisualSettings;
  instrumentId: InstrumentId;
  volume: number;
  width: number;
  height: number;
  fps: ExportFps;
  includeAudio: boolean;
  /** Soft tail after last note (reverb / particle fade) */
  tailSeconds?: number;
  onProgress?: (p: ExportProgress) => void;
  isCancelled?: () => boolean;
};

async function pickVideoCodec(width: number, height: number): Promise<VideoCodec | null> {
  const preferred: VideoCodec[] = ['avc', 'hevc', 'vp9', 'av1', 'vp8'];
  for (const codec of preferred) {
    try {
      if (await canEncodeVideo(codec, { width, height, quality: QUALITY_HIGH })) {
        return codec;
      }
    } catch {
      /* try next */
    }
  }
  return getFirstEncodableVideoCodec(preferred, { width, height, quality: QUALITY_HIGH });
}

async function pickAudioCodec(): Promise<AudioCodec | null> {
  const preferred: AudioCodec[] = ['aac', 'opus', 'mp3'];
  for (const codec of preferred) {
    try {
      if (await canEncodeAudio(codec, { quality: QUALITY_HIGH })) return codec;
    } catch {
      /* try next */
    }
  }
  return getFirstEncodableAudioCodec(preferred, { quality: QUALITY_HIGH });
}

/**
 * Offline-render audio with Tone (Tone instruments match live sound;
 * GM/SF2 fall back to Soft Piano in the offline context).
 */
async function renderOfflineAudio(
  song: Song,
  tracks: TrackInfo[],
  instrumentId: InstrumentId,
  duration: number,
  volume: number,
): Promise<{ buffer: AudioBuffer; usedFallback: boolean } | null> {
  try {
    const Tone = await import('tone');
    const muted = new Set(tracks.filter((t) => t.muted || !t.visible).map((t) => t.index));
    const info = getInstrumentInfo(instrumentId);
    const usedFallback = info.backend !== 'tone';
    const toneId: BuiltinInstrumentId =
      info.backend === 'tone' && instrumentId !== 'sf2'
        ? (instrumentId as BuiltinInstrumentId)
        : 'piano';

    const toneBuf = await Tone.Offline(({ transport }) => {
      const synth = createToneInstrument(Tone, toneId);
      const db = volume <= 0.001 ? -60 : 20 * Math.log10(Math.max(0.001, volume)) - 6;
      if (synth.volume) synth.volume.value = db;

      for (const n of song.notes) {
        if (muted.has(n.trackIndex)) continue;
        if (n.duration <= 0.01) continue;
        const pitchName = Tone.Frequency(n.pitch, 'midi').toNote();
        const vel = n.velocity;
        const start = n.start;
        const dur = n.duration;
        transport.schedule((time: number) => {
          try {
            if (typeof synth.triggerAttackRelease === 'function') {
              synth.triggerAttackRelease(pitchName, dur, time, vel);
            } else if (typeof synth.triggerAttack === 'function') {
              synth.triggerAttack(pitchName, time, vel);
              synth.triggerRelease(pitchName, time + dur);
            }
          } catch {
            /* voice steal */
          }
        }, start);
      }
      transport.start(0);
    }, duration);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = toneBuf as any;
    let buffer: AudioBuffer | null = null;

    if (raw instanceof AudioBuffer) {
      buffer = raw;
    } else if (typeof raw?.get === 'function') {
      buffer = raw.get() as AudioBuffer;
    } else if (raw?.numberOfChannels && raw?.length && raw?.sampleRate) {
      const ab = new AudioBuffer({
        numberOfChannels: raw.numberOfChannels,
        length: raw.length,
        sampleRate: raw.sampleRate,
      });
      for (let c = 0; c < raw.numberOfChannels; c++) {
        const data =
          typeof raw.getChannelData === 'function'
            ? raw.getChannelData(c)
            : raw.toArray?.()?.[c];
        if (data) ab.copyToChannel(new Float32Array(data), c);
      }
      buffer = ab;
    }

    if (!buffer) return null;
    return { buffer, usedFallback };
  } catch (e) {
    console.warn('Offline audio bake failed', e);
    return null;
  }
}

function yieldToUi() {
  return new Promise<void>((r) => {
    setTimeout(r, 0);
  });
}

/**
 * Bake a full MP4 offline — stepped frames at exact fps (smooth, no drops).
 */
export async function bakeOfflineVideo(opts: BakeOptions): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('WebCodecs is required for smooth bake (use Chrome or Edge)');
  }

  const {
    song,
    tracks,
    settings,
    instrumentId,
    volume,
    width,
    height,
    fps,
    includeAudio,
    tailSeconds = 0.75,
    onProgress,
    isCancelled,
  } = opts;

  const duration = Math.max(0.1, song.duration + tailSeconds);
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const dt = 1 / fps;

  const report = (partial: Partial<ExportProgress> & { phase: ExportProgress['phase'] }) => {
    onProgress?.({
      elapsed: 0,
      duration,
      ...partial,
    });
  };

  report({ phase: 'preparing', message: 'Preparing offline bake…', elapsed: 0 });

  const videoCodec = await pickVideoCodec(width, height);
  if (!videoCodec) {
    throw new Error('No encodable video codec (need WebCodecs H.264/VP9 support)');
  }

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : (() => {
          const c = document.createElement('canvas');
          c.width = width;
          c.height = height;
          return c;
        })();

  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Could not create bake canvas context');

  const engine = new VisualizerEngine();
  engine.reset();

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });

  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    quality: QUALITY_HIGH,
    keyFrameInterval: 0.5,
    latencyMode: 'quality',
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  let audioNote = '';

  if (includeAudio) {
    report({ phase: 'preparing', message: 'Rendering audio offline…', elapsed: 0 });
    const audioResult = await renderOfflineAudio(song, tracks, instrumentId, duration, volume);
    if (audioResult) {
      if (audioResult.usedFallback) {
        audioNote = ' · audio Soft Piano (GM/SF2 offline fallback)';
      }
      const audioCodec = await pickAudioCodec();
      if (audioCodec) {
        audioSource = new AudioBufferSource({
          codec: audioCodec,
          quality: QUALITY_HIGH,
        });
        output.addAudioTrack(audioSource);
      }
      // Store buffer for after start
      (audioSource as unknown as { __buf?: AudioBuffer }).__buf = audioResult.buffer;
    }
  }

  if (isCancelled?.()) {
    await output.cancel().catch(() => undefined);
    throw new Error('cancelled');
  }

  await output.start();

  if (audioSource) {
    const buf = (audioSource as unknown as { __buf?: AudioBuffer }).__buf;
    if (buf) {
      await audioSource.add(buf);
    }
    audioSource.close();
  }

  report({
    phase: 'recording',
    message: `Baking frames…${audioNote}`,
    elapsed: 0,
  });

  let prevTime = -0.0001;
  const batch = fps >= 60 ? 3 : 5;

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (isCancelled?.()) {
        videoSource.close();
        await output.cancel();
        throw new Error('cancelled');
      }

      const time = i * dt;
      // Engine expects CanvasRenderingContext2D; Offscreen's 2d API is compatible
      engine.render(ctx as CanvasRenderingContext2D, width, height, {
        song,
        tracks,
        settings,
        time,
        dt,
        prevTime,
        processSongHits: true,
        showEmptyHint: false,
      });
      prevTime = time;

      await videoSource.add(time, dt);

      if (i % batch === 0 || i === totalFrames - 1) {
        report({
          phase: 'recording',
          elapsed: time,
          duration,
          message: `Baking ${i + 1}/${totalFrames} frames${audioNote}`,
        });
        await yieldToUi();
      }
    }

    videoSource.close();

    report({ phase: 'finalizing', elapsed: duration, duration, message: 'Muxing MP4…' });
    await output.finalize();
  } catch (e) {
    if (output.state === 'started' || output.state === 'finalizing') {
      await output.cancel().catch(() => undefined);
    }
    throw e;
  }

  const buf = target.buffer;
  if (!buf || buf.byteLength < 64) {
    throw new Error('Bake produced an empty file');
  }

  return new Blob([buf], { type: 'video/mp4' });
}
