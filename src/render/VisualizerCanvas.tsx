import { useEffect, useRef } from 'react';
import type { NoteEvent, Song, TrackInfo, VisualSettings } from '../midi/types';
import { playbackEngine } from '../engine/PlaybackEngine';
import { EXPORT_DESIGN } from '../export/VideoExporter';
import { VisualizerEngine } from './VisualizerEngine';

export type ExportResolution = {
  width: number;
  height: number;
};

type Props = {
  song: Song | null;
  tracks: TrackInfo[];
  settings: VisualSettings;
  seekTime: number;
  playing: boolean;
  /** When set, lock canvas bitmap to this size (for video export). CSS still fills parent. */
  exportResolution?: ExportResolution | null;
  /** Pause live rAF (used while offline bake owns rendering). */
  suspendLiveDraw?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
};

export function VisualizerCanvas({
  song,
  tracks,
  settings,
  seekTime,
  playing,
  exportResolution = null,
  suspendLiveDraw = false,
  onCanvasReady,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef(new VisualizerEngine());
  const lastFrameRef = useRef(performance.now());
  const tracksRef = useRef(tracks);
  const settingsRef = useRef(settings);
  const songRef = useRef(song);
  const seekTimeRef = useRef(seekTime);
  const playingRef = useRef(playing);
  const exportResRef = useRef(exportResolution);
  const suspendRef = useRef(suspendLiveDraw);
  /** Logical draw size (matches ctx transform space) for hit FX */
  const viewSizeRef = useRef({ w: 1, h: 1 });

  tracksRef.current = tracks;
  settingsRef.current = settings;
  songRef.current = song;
  seekTimeRef.current = seekTime;
  playingRef.current = playing;
  exportResRef.current = exportResolution;
  suspendRef.current = suspendLiveDraw;

  useEffect(() => {
    onCanvasReady?.(canvasRef.current);
    return () => onCanvasReady?.(null);
  }, [onCanvasReady]);

  useEffect(() => {
    const engine = engineRef.current;
    playbackEngine.setOnNoteHit((note: NoteEvent) => {
      if (suspendRef.current) return;
      const s = settingsRef.current;
      const { w, h } = viewSizeRef.current;
      engine.noteHit(note, w, h, s, tracksRef.current, playbackEngine.getTime());
    });
    return () => playbackEngine.setOnNoteHit(null);
  }, []);

  useEffect(() => {
    engineRef.current.reset();
  }, [song]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const exp = exportResRef.current;
      if (exp && exp.width > 0 && exp.height > 0) {
        // Lock bitmap to export size; paint in 1080p design space (see draw loop)
        canvas.width = exp.width;
        canvas.height = exp.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        const sx = exp.width / EXPORT_DESIGN.width;
        const sy = exp.height / EXPORT_DESIGN.height;
        ctx.setTransform(sx, 0, 0, sy, 0, 0);
      } else {
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      engineRef.current.reseatBackground();
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const draw = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(draw);

      if (suspendRef.current) {
        lastFrameRef.current = now;
        return;
      }

      const dt = Math.min(0.05, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;

      const s = settingsRef.current;
      const currentSong = songRef.current;
      const currentTracks = tracksRef.current;
      const exp = exportResRef.current;
      // Export: design-space layout scaled to output. Live: CSS logical size.
      let w: number;
      let h: number;
      if (exp && exp.width > 0 && exp.height > 0) {
        w = EXPORT_DESIGN.width;
        h = EXPORT_DESIGN.height;
        const sx = exp.width / EXPORT_DESIGN.width;
        const sy = exp.height / EXPORT_DESIGN.height;
        ctx.setTransform(sx, 0, 0, sy, 0, 0);
      } else {
        const dpr = window.devicePixelRatio || 1;
        w = canvas.width / dpr;
        h = canvas.height / dpr;
      }
      viewSizeRef.current = { w, h };

      const isPlaying = playingRef.current;
      const time = isPlaying ? playbackEngine.getTime() : seekTimeRef.current;
      if (isPlaying) playbackEngine.tickHits();

      engineRef.current.render(ctx, w, h, {
        song: currentSong,
        tracks: currentTracks,
        settings: s,
        time,
        dt,
        prevTime: time,
        processSongHits: false,
        liveHeld: playbackEngine.getLiveNotes(),
        liveVisual: playbackEngine.getLiveVisualNotes(),
        wallNow: performance.now(),
        showEmptyHint: true,
      });
    };

    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (exportResolution && exportResolution.width > 0) {
      canvas.width = exportResolution.width;
      canvas.height = exportResolution.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      const sx = exportResolution.width / EXPORT_DESIGN.width;
      const sy = exportResolution.height / EXPORT_DESIGN.height;
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
    } else {
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    engineRef.current.reseatBackground();
  }, [exportResolution]);

  return <canvas ref={canvasRef} className="visualizer-canvas" />;
}
