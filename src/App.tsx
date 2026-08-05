import { useCallback, useEffect, useRef, useState } from 'react';
import { parseMidiFile } from './midi/parseMidi';
import {
  bpmAt,
  clampTempoScale,
  scaleSongTempo,
  type Song,
  type TrackInfo,
  type VisualSettings,
} from './midi/types';
import { DEFAULT_VISUAL_SETTINGS } from './theme/defaultPalette';
import {
  applyPaletteToTracks,
  normalizeColorSettings,
  type ColorSettings,
} from './theme/colorPresets';
import {
  DEFAULT_RANDOMIZER_CONFIG,
  type RandomizerConfig,
  distanceRough,
  lerpSettings,
  pickColorFlipSeconds,
  pickDanceHoldSeconds,
  randomizeContinuousTargets,
  randomizeDiscreteFlip,
  randomizeSelected,
} from './theme/randomizerConfig';
import { playbackEngine } from './engine/PlaybackEngine';
import { VisualizerCanvas } from './render/VisualizerCanvas';
import { BpmControl } from './ui/BpmControl';
import { TransportBar } from './ui/TransportBar';
import { TrackPanel } from './ui/TrackPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { RandomizerDock } from './ui/RandomizerDock';
import { HomePage } from './ui/HomePage';
import { SoundPanel } from './ui/SoundPanel';
import { MidiPanel } from './ui/MidiPanel';
import { ScenePresetPanel } from './ui/ScenePresetPanel';
import { ExportPanel } from './ui/ExportPanel';
import type { InstrumentId } from './engine/instruments';
import type { ScenePreset } from './theme/scenePresets';
import { hydrateSceneData } from './theme/scenePresets';
import { computerPiano } from './engine/ComputerPiano';
import { midiIO } from './engine/MidiIO';
import {
  DEFAULT_EXPORT_SETTINGS,
  VideoExporter,
  canBakeOffline,
  downloadBlob,
  exportExtension,
  pickRecorderMime,
  sanitizeFilename,
  sleep,
  waitForPlaybackIdle,
  type ExportProgress,
  type ExportSettings,
} from './export/VideoExporter';
import './App.css';

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function cloneSettings(s: VisualSettings): VisualSettings {
  return {
    ...s,
    notes: { ...s.notes },
    particles: { ...s.particles },
    background: { ...s.background },
    musicReactive: { ...s.musicReactive },
    colors: normalizeColorSettings(s.colors),
  };
}

type AppScreen = 'home' | 'app';

function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

function screenFromPath(pathname: string): AppScreen {
  return normalizePath(pathname) === '/player' ? 'app' : 'home';
}

function pathForScreen(screen: AppScreen): string {
  return screen === 'app' ? '/player' : '/';
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  /** Playback tempo multiplier (1 = file original). Synced with PlaybackEngine. */
  const [tempoScale, setTempoScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<VisualSettings>(() => ({
    ...DEFAULT_VISUAL_SETTINGS,
    notes: { ...DEFAULT_VISUAL_SETTINGS.notes },
    musicReactive: { ...DEFAULT_VISUAL_SETTINGS.musicReactive },
    colors: normalizeColorSettings(DEFAULT_VISUAL_SETTINGS.colors),
    particles: { ...DEFAULT_VISUAL_SETTINGS.particles },
    background: { ...DEFAULT_VISUAL_SETTINGS.background },
  }));
  const [randomizer, setRandomizer] = useState<RandomizerConfig>({
    ...DEFAULT_RANDOMIZER_CONFIG,
    categories: { ...DEFAULT_RANDOMIZER_CONFIG.categories },
  });
  const [dragOver, setDragOver] = useState(false);
  const [playerOnly, setPlayerOnly] = useState(false);
  /** Overlay studio panel while in player fullscreen (does not shrink the stage) */
  const [fsSidebarOpen, setFsSidebarOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideChromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Landing (/) vs studio (/player) - synced with the URL */
  const [screen, setScreen] = useState<AppScreen>(() =>
    typeof window !== 'undefined' ? screenFromPath(window.location.pathname) : 'home',
  );
  const [instrumentId, setInstrumentId] = useState<InstrumentId>('piano');
  const [sf2Name, setSf2Name] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.85);
  const [activeScenePresetId, setActiveScenePresetId] = useState<string | null>(null);
  /** One studio section at a time so the sidebar stays short */
  const [sidebarTab, setSidebarTab] = useState<'scene' | 'audio' | 'look' | 'export'>('scene');
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    ...DEFAULT_EXPORT_SETTINGS,
  });
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    phase: 'idle',
    elapsed: 0,
    duration: 0,
  });
  const [exportResolution, setExportResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [suspendLiveDraw, setSuspendLiveDraw] = useState(false);

  const settingsRef = useRef(settings);
  const randomizerRef = useRef(randomizer);
  const tracksRef = useRef(tracks);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const exporterRef = useRef<VideoExporter | null>(null);
  const exportCancelRef = useRef(false);
  settingsRef.current = settings;
  randomizerRef.current = randomizer;
  tracksRef.current = tracks;

  const onCanvasReady = useCallback((c: HTMLCanvasElement | null) => {
    canvasElRef.current = c;
  }, []);

  // Party mode dance state
  const partyFromRef = useRef<VisualSettings>(cloneSettings(settings));
  const partyToRef = useRef<VisualSettings>(cloneSettings(settings));
  const partyTRef = useRef(0);
  const partyHoldRef = useRef(0);
  const partyFlipRef = useRef(0);
  const partyLastUiRef = useRef(0);

  const applySettings = useCallback((next: VisualSettings, prevPalette?: string) => {
    const prev = prevPalette ?? settingsRef.current.colors.paletteId;
    setSettings(next);
    if (next.colors.paletteId !== prev && tracksRef.current.length > 0) {
      const colored = applyPaletteToTracks(tracksRef.current, next.colors.paletteId);
      setTracks(colored);
      playbackEngine.updateTracks(colored);
      setSong((s) => (s ? { ...s, tracks: colored } : s));
    }
  }, []);

  // Sync engine → React
  useEffect(() => {
    const unsub = playbackEngine.subscribe(() => {
      setPlaying(playbackEngine.getState() === 'playing');
      setTracks(playbackEngine.getTracks());
      setSong(playbackEngine.getSong());
    });
    return () => {
      unsub();
    };
  }, []);

  // Live MIDI in → sound + visuals (input filter / thru handled in MidiIO)
  useEffect(() => {
    const unsubNote = midiIO.onNote((msg) => {
      if (msg.type === 'noteon') {
        void playbackEngine.liveNoteOn(msg.pitch, msg.velocity, msg.channel);
      } else {
        playbackEngine.liveNoteOff(msg.pitch, msg.channel);
      }
    });
    const unsubCc = midiIO.onControl((msg) => {
      // CC 64 sustain pedal (≥64 = down)
      if (msg.controller === 64) {
        playbackEngine.setSustainPedal(msg.channel, msg.value >= 64);
      }
      // CC 120/123 all sound / all notes off - clear live + pedal
      if (msg.controller === 120 || msg.controller === 123) {
        playbackEngine.releaseLiveNotes();
      }
    });
    return () => {
      unsubNote();
      unsubCc();
    };
  }, []);

  // QWERTY piano listeners (prefs live in computerPiano singleton)
  useEffect(() => {
    computerPiano.attach();
    return () => computerPiano.detach();
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setCurrentTime(playbackEngine.getTime());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Party mode loop - smooth sliding params
  useEffect(() => {
    if (!randomizer.partyMode) return;

    // Seed dance targets when party starts
    const cats = randomizer.categories;
    partyFromRef.current = cloneSettings(settingsRef.current);
    partyToRef.current = randomizeContinuousTargets(partyFromRef.current, cats);
    partyTRef.current = 0;
    partyHoldRef.current = pickDanceHoldSeconds(randomizer.danceSpeed);
    partyFlipRef.current = pickColorFlipSeconds(randomizer.colorSwitchRate);

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cfg = randomizerRef.current;
      if (!cfg.partyMode) return;

      const catsNow = cfg.categories;
      const speed = cfg.danceSpeed;

      partyHoldRef.current -= dt;
      partyFlipRef.current -= dt;
      partyTRef.current = Math.min(1, partyTRef.current + dt * (0.22 * speed));

      // New continuous targets when we arrive / hold ends
      if (partyTRef.current >= 0.98 || partyHoldRef.current <= 0) {
        const current = lerpSettings(
          partyFromRef.current,
          partyToRef.current,
          1,
          catsNow,
        );
        partyFromRef.current = current;
        partyToRef.current = randomizeContinuousTargets(current, catsNow);
        partyTRef.current = 0;
        partyHoldRef.current = pickDanceHoldSeconds(speed);
      }

      // Occasional palette / mode / style flip (discrete)
      if (partyFlipRef.current <= 0) {
        const flipped = randomizeDiscreteFlip(partyToRef.current, catsNow);
        partyToRef.current = flipped;
        // also nudge from so discrete fields update on next lerp snap
        partyFromRef.current = {
          ...partyFromRef.current,
          colors: {
            ...partyFromRef.current.colors,
            mode: flipped.colors.mode,
            paletteId: flipped.colors.paletteId,
          },
          background: {
            ...partyFromRef.current.background,
            style: flipped.background.style,
          },
          backgroundColor: flipped.backgroundColor,
        };
        partyFlipRef.current = pickColorFlipSeconds(cfg.colorSwitchRate);
      }

      const blended = lerpSettings(
        partyFromRef.current,
        partyToRef.current,
        partyTRef.current,
        catsNow,
      );

      // ~30fps UI updates keeps the dance smooth without thrashing every frame
      const prevPal = settingsRef.current.colors.paletteId;
      const paletteChanged = blended.colors.paletteId !== prevPal;
      const modeChanged = blended.colors.mode !== settingsRef.current.colors.mode;
      if (paletteChanged || modeChanged || now - partyLastUiRef.current > 33) {
        partyLastUiRef.current = now;
        applySettings(blended, prevPal);
      } else {
        settingsRef.current = blended;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [randomizer.partyMode, applySettings]);

  // When categories / speeds change mid-party, retarget gently
  useEffect(() => {
    if (!randomizer.partyMode) return;
    partyToRef.current = randomizeContinuousTargets(
      settingsRef.current,
      randomizer.categories,
    );
    partyFromRef.current = cloneSettings(settingsRef.current);
    partyTRef.current = 0;
  }, [randomizer.categories, randomizer.danceSpeed, randomizer.partyMode]);

  const onSurprise = useCallback(() => {
    const cats = randomizerRef.current.categories;
    const prevPal = settingsRef.current.colors.paletteId;
    const next = randomizeSelected(settingsRef.current, cats);
    applySettings(next, prevPal);
    if (randomizerRef.current.partyMode) {
      partyFromRef.current = cloneSettings(next);
      partyToRef.current = randomizeContinuousTargets(next, cats);
      partyTRef.current = 0;
    }
  }, [applySettings]);

  const exitPlayerOnly = useCallback(async () => {
    setPlayerOnly(false);
    setFsSidebarOpen(false);
    setChromeVisible(true);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const enterPlayerOnly = useCallback(async () => {
    setPlayerOnly(true);
    setFsSidebarOpen(false);
    setChromeVisible(true);
    const el = playerRef.current;
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen();
      } catch {
        /* chrome-less only */
      }
    }
  }, []);

  const togglePlayerOnly = useCallback(() => {
    if (playerOnly) void exitPlayerOnly();
    else void enterPlayerOnly();
  }, [playerOnly, enterPlayerOnly, exitPlayerOnly]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && playerOnly) {
        setPlayerOnly(false);
        setFsSidebarOpen(false);
        setChromeVisible(true);
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [playerOnly]);

  const bumpChrome = useCallback(() => {
    if (!playerOnly) return;
    setChromeVisible(true);
    if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current);
    hideChromeTimer.current = setTimeout(() => setChromeVisible(false), 2200);
  }, [playerOnly]);

  useEffect(() => {
    if (!playerOnly) {
      setChromeVisible(true);
      if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current);
      return;
    }
    bumpChrome();
    return () => {
      if (hideChromeTimer.current) clearTimeout(hideChromeTimer.current);
    };
  }, [playerOnly, bumpChrome]);

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().match(/\.midi?$/)) {
        setError('Please choose a .mid or .midi file');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const parsed = await parseMidiFile(file);
        if (parsed.notes.length === 0) {
          setError('No notes found in this MIDI file');
          setLoading(false);
          return;
        }
        const colored = applyPaletteToTracks(
          parsed.tracks,
          settingsRef.current.colors.paletteId,
        );
        const songWithColors = { ...parsed, tracks: colored };
        playbackEngine.setSong(songWithColors);
        setSong(songWithColors);
        setTracks(colored);
        setCurrentTime(0);
        setTempoScale(1);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Failed to parse MIDI');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onPlayPause = useCallback(async () => {
    if (!playbackEngine.getSong()) return;
    if (playbackEngine.getState() === 'playing') {
      playbackEngine.pause();
    } else {
      try {
        await playbackEngine.play();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Audio failed to start');
      }
    }
  }, []);

  const onStop = useCallback(() => {
    playbackEngine.stop();
    setCurrentTime(0);
  }, []);

  const applyEffectiveBpm = useCallback(
    (nextBpm: number) => {
      if (!song) return;
      const base = bpmAt(song.tempos, playbackEngine.getTime()) ?? 120;
      if (!(base > 0)) return;
      const clamped = Math.min(400, Math.max(20, nextBpm));
      const nextScale = clampTempoScale(clamped / base);
      playbackEngine.setTempoScale(nextScale);
      setTempoScale(nextScale);
    },
    [song],
  );

  const onBpmDelta = useCallback(
    (delta: number) => {
      if (!song) return;
      const base = bpmAt(song.tempos, playbackEngine.getTime()) ?? 120;
      const current = base * playbackEngine.getTempoScale();
      applyEffectiveBpm(current + delta);
    },
    [song, applyEffectiveBpm],
  );

  const onBpmSet = useCallback(
    (bpm: number) => {
      applyEffectiveBpm(bpm);
    },
    [applyEffectiveBpm],
  );

  const onBpmReset = useCallback(() => {
    playbackEngine.setTempoScale(1);
    setTempoScale(1);
  }, []);

  const onSeek = useCallback((t: number) => {
    playbackEngine.seek(t);
    setCurrentTime(t);
  }, []);

  const onTracksChange = useCallback((next: TrackInfo[]) => {
    setTracks(next);
    playbackEngine.updateTracks(next);
    setSong((s) => (s ? { ...s, tracks: next } : s));
  }, []);

  const onColorsChange = useCallback((next: ColorSettings) => {
    setSettings((s) => ({ ...s, colors: normalizeColorSettings(next) }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Escape still exits fullscreen overlay even while playing piano
      if (e.code === 'Escape' && playerOnly) {
        e.preventDefault();
        if (fsSidebarOpen) setFsSidebarOpen(false);
        else void exitPlayerOnly();
        return;
      }

      // QWERTY piano owns the keyboard: no Space/R/F/B/arrows/party shortcuts
      if (computerPiano.isQwertyEnabled()) return;

      if (e.code === 'Space') {
        e.preventDefault();
        void onPlayPause();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        onStop();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onSeek(Math.max(0, playbackEngine.getTime() - 2));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onSeek(Math.min(playbackEngine.getDuration(), playbackEngine.getTime() + 2));
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        togglePlayerOnly();
      } else if (e.code === 'KeyP' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setRandomizer((c) => ({ ...c, partyMode: !c.partyMode }));
      } else if (e.code === 'KeyB' && playerOnly) {
        e.preventDefault();
        setFsSidebarOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    onPlayPause,
    onStop,
    onSeek,
    togglePlayerOnly,
    exitPlayerOnly,
    playerOnly,
    fsSidebarOpen,
  ]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  // silence unused helper in prod tree
  void distanceRough;

  const goToScreen = useCallback((next: AppScreen, mode: 'push' | 'replace' = 'push') => {
    const path = pathForScreen(next);
    const current = normalizePath(window.location.pathname);
    if (current !== path) {
      if (mode === 'replace') window.history.replaceState({ screen: next }, '', path);
      else window.history.pushState({ screen: next }, '', path);
    }
    setScreen(next);
  }, []);

  // Keep React screen in sync with URL (back/forward + first load cleanup)
  useEffect(() => {
    const path = normalizePath(window.location.pathname);
    if (path !== '/' && path !== '/player') {
      window.history.replaceState({ screen: 'home' }, '', '/');
      setScreen('home');
    } else {
      setScreen(screenFromPath(path));
    }
    const onPop = () => setScreen(screenFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const enterApp = useCallback(() => goToScreen('app'), [goToScreen]);

  const goHome = useCallback(() => {
    if (playerOnly) void exitPlayerOnly();
    goToScreen('home');
  }, [exitPlayerOnly, goToScreen, playerOnly]);

  const enterWithMidi = useCallback(
    (file: File) => {
      goToScreen('app');
      void loadFile(file);
    },
    [goToScreen, loadFile],
  );

  const cancelExport = useCallback(() => {
    exportCancelRef.current = true;
    try {
      exporterRef.current?.cancel();
    } catch {
      /* ignore */
    }
    exporterRef.current = null;
    playbackEngine.pause();
    setSuspendLiveDraw(false);
    setExportResolution(null);
    setExportBusy(false);
    setExportProgress({
      phase: 'cancelled',
      elapsed: 0,
      duration: 0,
      message: 'Export cancelled',
    });
  }, []);

  const startExport = useCallback(async () => {
    const currentSong = playbackEngine.getSong();
    if (!currentSong) {
      setError('Load a MIDI file before exporting');
      return;
    }

    const { width, height, fps, includeAudio, mode } = exportSettings;

    if (mode === 'bake' && !canBakeOffline()) {
      setError('Smooth bake needs WebCodecs (Chrome or Edge)');
      return;
    }
    if (mode === 'realtime' && !pickRecorderMime()) {
      setError('Realtime export needs MediaRecorder (try Chrome or Edge)');
      return;
    }

    exportCancelRef.current = false;
    setExportBusy(true);
    setError(null);
    setRandomizer((r) => ({ ...r, partyMode: false }));
    playbackEngine.pause();

    // ── Offline bake (smooth, no dropped frames) ──
    if (mode === 'bake') {
      setSuspendLiveDraw(true);
      setExportProgress({
        phase: 'preparing',
        elapsed: 0,
        duration: currentSong.duration,
        message: 'Starting offline bake…',
      });
      try {
        // Lazy-load mediabunny encoder stack
        const { bakeOfflineVideo } = await import('./export/offlineBake');
        const scale = playbackEngine.getTempoScale();
        const bakeSong = scaleSongTempo(currentSong, scale);
        const blob = await bakeOfflineVideo({
          song: bakeSong,
          tracks: playbackEngine.getTracks(),
          settings: settingsRef.current,
          instrumentId: playbackEngine.audio.getInstrumentId(),
          volume: playbackEngine.audio.getVolume(),
          width,
          height,
          fps,
          includeAudio,
          onProgress: setExportProgress,
          isCancelled: () => exportCancelRef.current,
        });

        if (exportCancelRef.current) {
          setExportProgress({
            phase: 'cancelled',
            elapsed: 0,
            duration: 0,
            message: 'Export cancelled',
          });
          return;
        }

        const fname = `${sanitizeFilename(currentSong.name)}-lumenote-${fps}fps-bake.mp4`;
        downloadBlob(blob, fname);
        setExportProgress({
          phase: 'done',
          elapsed: currentSong.duration,
          duration: currentSong.duration,
          message: `Saved ${fname}`,
        });
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : 'Bake failed';
        if (msg === 'cancelled') {
          setExportProgress({
            phase: 'cancelled',
            elapsed: 0,
            duration: 0,
            message: 'Export cancelled',
          });
        } else {
          setExportProgress({
            phase: 'error',
            elapsed: 0,
            duration: 0,
            message: msg,
          });
          setError(msg);
        }
      } finally {
        setSuspendLiveDraw(false);
        setExportResolution(null);
        setExportBusy(false);
      }
      return;
    }

    // ── Realtime MediaRecorder capture ──
    setExportProgress({
      phase: 'preparing',
      elapsed: 0,
      duration: currentSong.duration,
      message: `Preparing ${width}×${height} canvas…`,
    });
    setExportResolution({ width, height });
    await sleep(120);
    if (exportCancelRef.current) {
      setExportBusy(false);
      setExportResolution(null);
      return;
    }

    const canvas = canvasElRef.current;
    if (!canvas) {
      setExportBusy(false);
      setExportResolution(null);
      setExportProgress({
        phase: 'error',
        elapsed: 0,
        duration: 0,
        message: 'Visualizer canvas not ready',
      });
      return;
    }

    try {
      await playbackEngine.audio.init();
      if (exportCancelRef.current) return;

      playbackEngine.stop();
      await sleep(40);

      const exporter = new VideoExporter();
      exporterRef.current = exporter;
      const audioStream = includeAudio ? playbackEngine.audio.getRecordStream() : null;

      exporter.start({
        canvas,
        audioStream,
        fps,
        width,
        height,
        includeAudio,
      });

      setExportProgress({
        phase: 'recording',
        elapsed: 0,
        duration: currentSong.duration,
        message: 'Recording…',
      });

      await playbackEngine.play();
      if (exportCancelRef.current) {
        exporter.cancel();
        return;
      }

      const progressTimer = window.setInterval(() => {
        if (exportCancelRef.current) return;
        setExportProgress((p) => ({
          ...p,
          phase: 'recording',
          elapsed: playbackEngine.getTime(),
          duration: playbackEngine.getDuration(),
          message: 'Recording…',
        }));
      }, 200);

      await waitForPlaybackIdle(
        () => playbackEngine.getState(),
        (fn) => playbackEngine.subscribe(fn),
      );
      window.clearInterval(progressTimer);

      if (exportCancelRef.current) {
        exporter.cancel();
        setExportResolution(null);
        setExportBusy(false);
        return;
      }

      setExportProgress({
        phase: 'finalizing',
        elapsed: currentSong.duration,
        duration: currentSong.duration,
        message: 'Finalizing…',
      });
      await sleep(600);

      const blob = await exporter.stop();
      exporterRef.current = null;

      if (exportCancelRef.current || blob.size < 64) {
        setExportProgress({
          phase: exportCancelRef.current ? 'cancelled' : 'error',
          elapsed: 0,
          duration: 0,
          message: exportCancelRef.current
            ? 'Export cancelled'
            : 'Recording produced an empty file',
        });
        setExportResolution(null);
        setExportBusy(false);
        return;
      }

      const mime = blob.type || pickRecorderMime();
      const ext = exportExtension(mime);
      const fname = `${sanitizeFilename(currentSong.name)}-lumenote-${fps}fps.${ext}`;
      downloadBlob(blob, fname);

      setExportProgress({
        phase: 'done',
        elapsed: currentSong.duration,
        duration: currentSong.duration,
        message: `Saved ${fname}`,
      });
    } catch (e) {
      console.error(e);
      try {
        exporterRef.current?.cancel();
      } catch {
        /* ignore */
      }
      exporterRef.current = null;
      setExportProgress({
        phase: 'error',
        elapsed: 0,
        duration: 0,
        message: e instanceof Error ? e.message : 'Export failed',
      });
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportResolution(null);
      setExportBusy(false);
      exporterRef.current = null;
    }
  }, [exportSettings]);

  const loadScenePreset = useCallback(
    async (preset: ScenePreset) => {
      const data = hydrateSceneData(preset);
      // Stop party so it doesn't overwrite the loaded look
      setRandomizer((r) => ({ ...r, partyMode: false }));
      applySettings(data.settings, settingsRef.current.colors.paletteId);
      setVolume(data.volume);
      playbackEngine.setVolume(data.volume);
      try {
        if (data.instrumentId === 'sf2' && !playbackEngine.audio.hasSf2()) {
          // Fall back until user reloads the soundfont
          await playbackEngine.setInstrument('piano');
          setInstrumentId('piano');
        } else {
          await playbackEngine.setInstrument(data.instrumentId);
          setInstrumentId(data.instrumentId);
        }
      } catch {
        await playbackEngine.setInstrument('piano');
        setInstrumentId('piano');
      }
      // Apply palette colors to tracks
      if (tracksRef.current.length > 0) {
        const colored = applyPaletteToTracks(
          tracksRef.current,
          data.settings.colors.paletteId,
        );
        setTracks(colored);
        playbackEngine.updateTracks(colored);
        setSong((s) => (s ? { ...s, tracks: colored } : s));
      }
      setActiveScenePresetId(preset.id);
    },
    [applySettings],
  );

  if (screen === 'home') {
    return (
      <div className="app app-home">
        <HomePage onEnter={enterApp} onOpenMidi={enterWithMidi} />
      </div>
    );
  }

  const fileBpm = song ? bpmAt(song.tempos, currentTime) : null;
  const displayBpm = fileBpm != null ? fileBpm * tempoScale : null;
  const tempoEdited = Math.abs(tempoScale - 1) > 1e-4;

  return (
    <div
      className={`app ${dragOver ? 'drag-over' : ''} ${playerOnly ? 'player-only' : ''} ${randomizer.partyMode ? 'is-partying' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {!playerOnly && (
        <TransportBar
          fileName={song?.name ?? null}
          playing={playing}
          currentTime={currentTime}
          duration={song?.duration ?? 0}
          bpm={displayBpm}
          tempoEdited={tempoEdited}
          playerOnly={playerOnly}
          onHome={goHome}
          onOpen={() => fileInputRef.current?.click()}
          onPlayPause={() => void onPlayPause()}
          onStop={onStop}
          onSeek={onSeek}
          onTogglePlayerOnly={togglePlayerOnly}
          onBpmDelta={onBpmDelta}
          onBpmSet={onBpmSet}
          onBpmReset={onBpmReset}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = '';
        }}
      />

      <div className={`main ${playerOnly ? 'main-player-only' : ''}`}>
        <div
          ref={playerRef}
          className={`stage ${playerOnly ? 'stage-player-only' : ''} ${playerOnly && fsSidebarOpen ? 'sidebar-open' : ''}`}
          onMouseMove={bumpChrome}
          onClick={bumpChrome}
        >
          <div className="stage-view">
            {loading && <div className="overlay">Loading MIDI…</div>}
            {error && (
              <div className="overlay error" onClick={() => setError(null)}>
                {error}
              </div>
            )}
            {randomizer.partyMode && (
              <div className="party-badge" title="Party mode active">
                🎉 Party
              </div>
            )}
            {exportBusy && (
              <div className="export-badge" title="Exporting video">
                {exportSettings.mode === 'bake' ? '◎ BAKE' : '● REC'}{' '}
                {exportSettings.width}×{exportSettings.height}@{exportSettings.fps}
              </div>
            )}
            <VisualizerCanvas
              song={song}
              tracks={tracks}
              settings={settings}
              seekTime={currentTime}
              playing={playing}
              exportResolution={exportResolution}
              suspendLiveDraw={suspendLiveDraw}
              onCanvasReady={onCanvasReady}
            />

            {playerOnly && (
              <div
                className={`player-chrome ${chromeVisible || fsSidebarOpen ? 'visible' : 'hidden'}`}
                onMouseMove={bumpChrome}
              >
                <div className="player-chrome-bar">
                  <div className="player-chrome-left">
                    <button
                      type="button"
                      className="btn compact-btn player-home-btn"
                      onClick={goHome}
                      title="Back to home"
                    >
                      Home
                    </button>
                    <span className="player-title" title={song?.name ?? undefined}>
                      {song?.name ?? 'No file'}
                    </span>
                    {randomizer.partyMode && <span className="party-inline">🎉</span>}
                  </div>
                  <div className="player-chrome-center">
                    <button type="button" className="btn icon" onClick={onStop} title="Stop (R)">
                      ⏹
                    </button>
                    <button
                      type="button"
                      className="btn icon play"
                      onClick={() => void onPlayPause()}
                      title="Play / Pause (Space)"
                    >
                      {playing ? '⏸' : '▶'}
                    </button>
                    <span className="time">
                      {formatTime(currentTime)}
                      <span className="time-sep">/</span>
                      {formatTime(song?.duration ?? 0)}
                    </span>
                    {displayBpm != null && (
                      <BpmControl
                        bpm={displayBpm}
                        tempoEdited={tempoEdited}
                        onDelta={onBpmDelta}
                        onSet={onBpmSet}
                        onReset={onBpmReset}
                      />
                    )}
                  </div>
                  <div className="player-chrome-right">
                    <button
                      type="button"
                      className={`btn compact-btn ${randomizer.partyMode ? 'party-on' : ''}`}
                      onClick={() =>
                        setRandomizer((c) => ({ ...c, partyMode: !c.partyMode }))
                      }
                      title="Toggle party mode"
                    >
                      🎉
                    </button>
                    <button
                      type="button"
                      className={`btn compact-btn ${fsSidebarOpen ? 'primary' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFsSidebarOpen((o) => !o);
                      }}
                      title="Studio panel (B)"
                    >
                      {fsSidebarOpen ? 'Panel ›' : '‹ Panel'}
                    </button>
                    <button
                      type="button"
                      className="btn primary compact-btn"
                      onClick={() => void exitPlayerOnly()}
                      title="Exit fullscreen (Esc / F)"
                    >
                      Exit ⛶
                    </button>
                  </div>
                </div>
                <input
                  className="scrubber player-scrubber"
                  type="range"
                  min={0}
                  max={Math.max(song?.duration ?? 0.01, 0.01)}
                  step={0.01}
                  value={Math.min(currentTime, song?.duration || 0)}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  disabled={!song}
                />
                <p className="player-hint">
                  Space play · B panel · F / Esc exit · move mouse for controls
                </p>
              </div>
            )}

            {!playerOnly && (
              <button
                type="button"
                className="btn icon stage-fullscreen-fab"
                onClick={() => void enterPlayerOnly()}
                title="Player fullscreen (F)"
              >
                ⛶
              </button>
            )}
          </div>

          {playerOnly && (
            <button
              type="button"
              className={`sidebar-edge-toggle ${fsSidebarOpen ? 'open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setFsSidebarOpen((o) => !o);
              }}
              title={fsSidebarOpen ? 'Hide studio panel (B)' : 'Show studio panel (B)'}
              aria-label={fsSidebarOpen ? 'Hide studio panel' : 'Show studio panel'}
              aria-expanded={fsSidebarOpen}
            >
              <span className="sidebar-edge-chevron" aria-hidden>
                {fsSidebarOpen ? '›' : '‹'}
              </span>
            </button>
          )}

          <aside
            className={`sidebar ${playerOnly ? 'sidebar-overlay' : ''} ${playerOnly && !fsSidebarOpen ? 'is-collapsed' : ''}`}
            onMouseMove={(e) => {
              e.stopPropagation();
              bumpChrome();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-brand-row">
              <div className="brand">
                <button
                  type="button"
                  className="brand-home-btn"
                  onClick={goHome}
                  title="Back to home"
                >
                  <h1>Lumenote</h1>
                  <p>{playerOnly ? 'Studio overlay' : 'Multi-track visualizer'}</p>
                </button>
              </div>
              <div className="sidebar-brand-actions">
                <button
                  type="button"
                  className="btn compact-btn sidebar-home-btn"
                  onClick={goHome}
                  title="Back to home"
                >
                  Home
                </button>
                {playerOnly && (
                  <button
                    type="button"
                    className="btn icon sidebar-dismiss"
                    onClick={() => setFsSidebarOpen(false)}
                    title="Hide panel (B)"
                    aria-label="Hide studio panel"
                  >
                    ›
                  </button>
                )}
              </div>
            </div>

            <nav className="sidebar-tabs" role="tablist" aria-label="Studio sections">
              {(
                [
                  { id: 'scene' as const, label: 'Scene' },
                  { id: 'audio' as const, label: 'Audio' },
                  { id: 'look' as const, label: 'Look' },
                  { id: 'export' as const, label: 'Export' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === t.id}
                  className={`sidebar-tab ${sidebarTab === t.id ? 'active' : ''}`}
                  onClick={() => setSidebarTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="sidebar-body">
              {sidebarTab === 'scene' && (
                <div className="sidebar-section" role="tabpanel">
                  <ScenePresetPanel
                    settings={settings}
                    instrumentId={instrumentId}
                    volume={volume}
                    activePresetId={activeScenePresetId}
                    onLoad={(p) => void loadScenePreset(p)}
                    onActiveId={setActiveScenePresetId}
                  />
                  <RandomizerDock
                    config={randomizer}
                    onChange={setRandomizer}
                    onSurprise={() => {
                      setActiveScenePresetId(null);
                      onSurprise();
                    }}
                  />
                </div>
              )}

              {sidebarTab === 'audio' && (
                <div className="sidebar-section" role="tabpanel">
                  <SoundPanel
                    instrumentId={instrumentId}
                    sf2Name={sf2Name}
                    volume={volume}
                    onInstrumentChange={(id) => {
                      setInstrumentId(id);
                      setActiveScenePresetId(null);
                    }}
                    onVolumeChange={(v) => {
                      setVolume(v);
                      setActiveScenePresetId(null);
                    }}
                    onSf2Loaded={setSf2Name}
                  />
                  <MidiPanel />
                </div>
              )}

              {sidebarTab === 'look' && (
                <div className="sidebar-section" role="tabpanel">
                  <TrackPanel
                    tracks={tracks}
                    colors={settings.colors}
                    onTracksChange={onTracksChange}
                    onColorsChange={onColorsChange}
                  />
                  <SettingsPanel
                    settings={settings}
                    onChange={(next) => {
                      applySettings(next, settings.colors.paletteId);
                    }}
                  />
                </div>
              )}

              {sidebarTab === 'export' && (
                <div className="sidebar-section" role="tabpanel">
                  <ExportPanel
                    hasSong={!!song}
                    duration={song?.duration ?? 0}
                    settings={exportSettings}
                    progress={exportProgress}
                    busy={exportBusy}
                    onChange={setExportSettings}
                    onStart={() => void startExport()}
                    onCancel={cancelExport}
                  />
                  <details className="panel tips sidebar-tips">
                    <summary>Shortcuts</summary>
                    <ul>
                      <li>
                        <kbd>Space</kbd> play/pause
                      </li>
                      <li>
                        <kbd>R</kbd> stop
                      </li>
                      <li>
                        <kbd>F</kbd> player fullscreen
                      </li>
                      <li>
                        <kbd>B</kbd> studio panel (fullscreen)
                      </li>
                      <li>
                        <kbd>Ctrl</kbd>+<kbd>P</kbd> party mode
                      </li>
                      <li>
                        <kbd>←</kbd> <kbd>→</kbd> seek 2s
                      </li>
                      <li>
                        QWERTY on: Virtual Piano 1–m · Shift +1 hold · ←/→ oct · ↑/↓ st ·
                        Space sustain · <kbd>Esc</kbd> exits fullscreen
                      </li>
                      <li>Tap or drag the on-screen keyboard to play</li>
                    </ul>
                  </details>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
