# Architecture

## High-level

```
┌─────────────┐     screen === 'home'      ┌──────────────┐
│  HomePage   │ ◄─────────────────────────►│  App studio  │
└─────────────┘     brand click / Launch   └──────┬───────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    ▼                             ▼                             ▼
             VisualizerCanvas              playbackEngine                  React UI
             (rAF → VisualizerEngine)      (singleton)                     sidebar
                    │                             │
         particles / notes / bg            AudioEngine
         music reactive field              Tone | TinySynth | Spessa SF2
                    │
              offlineBake (export)
              stepped frames + Mediabunny
```

## Playback

- **`PlaybackEngine`** (`src/engine/PlaybackEngine.ts`): song, tracks, play/pause/stop/seek, hit callbacks for particles, mute-aware reschedule.
- **Clock model:** `getTime() = pauseOffset + Tone.Transport.seconds` while playing (after audio ready).
- **Note schedule:** notes scheduled relative to `fromTime` with transport reset to 0 via `reanchorPlayback`.
- **Visual hits (live):** `tickHits()` walks notes by start time; fires `onNoteHit` for particles + impact rail.
- **Visual hits (bake):** `VisualizerEngine` advances a hit cursor by song time with fixed `dt`.

## Audio backends (`AudioEngine`)

| Backend | When | Notes |
|---------|------|--------|
| **Tone** | piano, chiptune, epiano, pad, … | `createToneInstrument` in `instruments.ts`; routes via Tone master bus |
| **TinySynth** | `gm_chip` (q=0), `gm_quality` (q=1) | `webaudio-tinysynth`, `noteOn/Off` |
| **SF2** | after user loads file | `spessasynth_lib` WorkletSynthesizer; worklet at `/spessasynth_processor.min.js` |

Instrument change mid-play: pause transport → switch → `reanchorPlayback`.

Live notes: `noteOn` / `noteOff` (immediate) - never schedule on transport; safe while a song plays.

### SF2 / native AudioContext

Tone uses **standardized-audio-context** wrappers. Spessa creates a native `AudioWorkletNode`, which requires a real `BaseAudioContext`.

- SF2 uses `getNativeAudioContext()` (unwrap or dedicated native `AudioContext`).
- SF2 has its own gain + `MediaStreamDestination` for speakers and realtime record merge.
- Do not pass Tone's wrapped `rawContext` into `WorkletSynthesizer`.

### Master bus / record

- Tone path: instruments → Tone.Gain → master gain → speakers + record stream.
- SF2 path: native bus → speakers + separate record tracks merged in `getRecordStream()`.

## Video export

### Bake (default, smooth)

1. `VisualizerEngine` draws each frame at `time = i/fps` with fixed `dt = 1/fps`.  
2. Hits/particles advance deterministically from song notes (no wall clock).  
3. [Mediabunny](https://mediabunny.dev/) `CanvasSource` + WebCodecs → **MP4**.  
4. Optional audio via `Tone.Offline` (Tone instruments match; GM/SF2 fall back to Soft Piano offline).  
5. Lazy-loaded chunk (`offlineBake.ts`) so Mediabunny is not in the initial bundle.

### Realtime (optional)

1. Lock live canvas bitmap to 1920×1080.  
2. `canvas.captureStream` + master-bus audio → `MediaRecorder` (can drop frames under load).

Code: `src/render/VisualizerEngine.ts`, `src/export/offlineBake.ts`, `src/export/VideoExporter.ts`, `src/ui/ExportPanel.tsx`.

## Live MIDI (`MidiIO`)

```
Hardware keyboard ──► midiIO (Web MIDI) ──► playbackEngine.liveNoteOn/Off
                                              ├─ AudioEngine.noteOn (local synth)
                                              └─ onNoteHit → particles / hit rail

Song schedule ──► transport callbacks ──► synth + midiIO.schedulePlaybackNote (optional out)
Input thru    ──► midiIO ──► selected MIDIOutput
```

- Enable from **Live MIDI** sidebar (user gesture → `requestMIDIAccess` + warm audio).
- Live bars grow from the hit line and scroll up after release (wall clock).
- Chrome/Edge/Opera desktop; Safari/Firefox lack Web MIDI (UI explains).

## Rendering

### Live (`VisualizerCanvas`)

- Single rAF loop (empty deps; reads refs).  
- Delegates paint to **`VisualizerEngine`**.  
- Optional `exportResolution` / `suspendLiveDraw` during export.

### Engine (`VisualizerEngine`)

Shared by live and bake:

1. Background effects (music energy)  
2. Music reactive ambient particles  
3. Falling notes (track/dynamic colors via `resolveNoteColor`)  
4. Hit rail  
5. Hit/sustain particle system  
6. Keyboard  

Settings come from React props → `settingsRef` each render. Party mode updates settings from App ~30fps.

## Settings model

`VisualSettings` in `src/midi/types.ts`:

- Core visuals (scroll, glow, keyboard height, hit rail, bg color)  
- `particles: ParticleParams`  
- `background: BackgroundParams`  
- `musicReactive: MusicReactiveParams`  
- `colors: ColorSettings` (includes palette scatter modes)  

Deep-cloned in presets / party / surprise via helpers in `theme/`.

## Party / Surprise

- **Surprise:** `randomizeSelected(settings, categories)` - hard jump.  
- **Party:** lerp from→to continuous params; occasional discrete flips (palette/mode/bg style).  
  Implementation lives in `App.tsx` + `theme/randomizerConfig.ts` + `theme/randomize.ts`.

## Scene presets

- Built-ins: `theme/scenePresets.ts` → `BUILTIN_SCENE_PRESETS`  
- User: `localStorage` key `lumenote-scene-presets-v1` (migrates legacy `notefall-scene-presets-v1`)  
- Capture: settings + instrumentId + volume  

## Data flow: load MIDI

1. `parseMidiFile` (`@tonejs/midi`) → `Song` (notes + tracks)  
2. Apply current color palette to tracks  
3. `playbackEngine.setSong` (stops previous)  
4. UI shows tracks; play schedules audio  

Single-track multi-channel MIDIs may be split by channel in `parseMidi.ts`.

## Studio UI

Sidebar sections: **Scene** · **Audio** · **Look** · **Export** · Shortcuts.  
Fullscreen: player-only stage; `B` / edge chevron overlays the same sidebar without shrinking the canvas.
