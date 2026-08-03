# Session notes — Lumenote

**Purpose:** handoff for a new chat/agent with a clean context window.  
**Last updated:** 2026-08-03 (rebrand → Lumenote)  

Read this first, then `docs/ARCHITECTURE.md` if you need to change code.

---

## What this project is

**Lumenote** — browser multi-track MIDI piano visualizer (Embers/SeeMusic-style, but ours, no watermark).

- Local path: `C:\Users\Matt\projects\midi-visualizer`
- GitHub: https://github.com/UnSlopd/lumenote (public, account **UnSlopd**)
- Stack: Vite + React + TypeScript, Canvas 2D, Tone.js / TinySynth / SpessaSynth (SF2)

---

## How to run

```bash
cd C:\Users\Matt\projects\midi-visualizer
npm install
npm run dev
# → http://127.0.0.1:5173 or localhost:5173

npm run build   # tsc + vite build
```

SF2 worklet must be served from public (already there):

- `public/spessasynth_processor.min.js` (copied from `spessasynth_lib`)

---

## Product surface (current)

| Area | What it does |
|------|----------------|
| **Home** | Landing page (`screen: 'home' \| 'app'` in `App.tsx`) |
| **Studio** | Player stage + right sidebar |
| **Scene presets** | Full lookbooks + user saves in `localStorage` (`lumenote-scene-presets-v1`) |
| **Surprise me** | Category toggles + one-shot randomize + **Party mode** (smooth param dance) |
| **Sound** | Built-in instruments + load SF2/SF3 |
| **Live MIDI** | Web MIDI in (keyboard) + out (song playback / thru) |
| **Colors** | Modes (track/RGB/pitch/…) + palettes |
| **Visuals / Particles / Background / Music reactive** | Detailed sliders + per-section randomize |
| **Fullscreen** | `F` / ⛶ — player-only chrome; **`B`** or edge **‹** opens studio panel as overlay |
| **Export video** | **Bake** (offline stepped frames, smooth MP4) or realtime MediaRecorder |

### Shortcuts

- `Space` play/pause · `R` stop · `←`/`→` seek 2s  
- `F` player fullscreen · `B` studio panel overlay · `Esc` close panel / exit · `Ctrl+P` party mode  

---

## Critical engineering decisions (do not regress)

### 1. Playback clock / desync

**Bug fixed:** color-only track updates used to call `updateTracks` → reschedule notes while Tone transport kept running → audio/visual desync.

**Rule:** `PlaybackEngine.updateTracks` only reschedules if **mute/visible** change. Color/name only updates metadata.  
When rescheduling is needed, use **`reanchorPlayback(songTime)`**: set `pauseOffset`, rebuild schedule relative to 0, `transportStart()` (seconds = 0).

### 2. Tone AudioContext

Do **not** import Tone at module top in a way that starts audio on page load.  
`AudioEngine` lazy-loads Tone / TinySynth / Spessa on user gesture (`play` / instrument change / SF2 load).

### 3. Party mode vs presets

Loading a **scene preset** should turn **party mode off** so dancing params don’t overwrite the loaded look.

### 4. SF2 in presets

Scene presets can store `instrumentId: 'sf2'` but **not** the soundfont binary. UI warns user to reload SF2 after loading such a preset.

### 5. Color settings resilience

`normalizeColorSettings()` merges partial/stale settings (HMR) so UI doesn’t crash on `.toFixed`.

### 6. Live MIDI

- **In:** `midiIO` → `playbackEngine.liveNoteOn/Off` (audio + keyboard/particles). Does **not** reschedule Tone transport.
- **Out:** song notes scheduled in the same transport callbacks as audio; optional **Thru** echoes input → output.
- Reanchor / pause / stop clears live held notes (synth `releaseAll` would leave stuck lit keys otherwise).
- Chrome/Edge/Opera desktop; not Safari/Firefox Web MIDI (UI explains).

---

## Key files (where to edit)

```
src/App.tsx                 # Screens, wiring, party loop, fullscreen, MIDI note bridge
src/engine/PlaybackEngine.ts
src/engine/AudioEngine.ts
src/engine/MidiIO.ts          # Web MIDI access, ports, thru / playback out
src/engine/instruments.ts
src/midi/parseMidi.ts
src/render/VisualizerCanvas.tsx   # Main rAF draw loop (+ live keys)
src/render/ParticleSystem.ts
src/render/MusicReactiveField.ts
src/render/BackgroundEffects.ts
src/render/HitRail.ts
src/theme/*                   # Presets, randomize, scene presets
src/ui/*                      # Panels (incl. MidiPanel, ExportPanel), home, transport
src/export/VideoExporter.ts   # Realtime capture helpers
src/export/offlineBake.ts     # Stepped-frame MP4 bake (Mediabunny)
src/render/VisualizerEngine.ts # Shared live + bake draw engine
docs/SESSION_NOTES.md         # This file
docs/ARCHITECTURE.md
docs/DEVELOPMENT.md
```

---

## Sidebar order (studio)

Grouped sections with labels; docked in studio, **overlay** in fullscreen (`B` / edge ‹):

1. Brand (click → home)  
2. **Scene** — presets · Surprise me / party  
3. **Audio** — Sound · Live MIDI  
4. **Look** — Colors/tracks · Visuals / reactive / bg / particles  
5. **Export** — 1080p realtime video (30/60 fps)  
6. **Shortcuts**  

Fullscreen: panel slides over the piano (does not shrink the stage).  

---

## Known limitations / future ideas

- Offline **bake** export (smooth 1080p MP4) + optional realtime capture  
- Live Web MIDI in/out (Chromium); no browser QWERTY piano yet  
- Party mode updates React ~30fps (throttled)  
- SF2 large files can be slow to load first time  
- Commit author email on GitHub: `slopdai@proton.me` (public in git history — not a secret, but personal)

---

## Security (already audited)

- No API keys, tokens, `.env`, or private keys in the repo  
- Client-only app; user SF2/presets stay local  
- Safe for public GitHub  

---

## Suggested next tasks (if user continues)

1. GitHub Pages / Vercel deploy + homepage URL on repo  
2. Offline bake: SF2/GM true offline audio (currently Soft Piano fallback)  
3. On-screen / QWERTY piano (in addition to hardware MIDI)  
4. Rewrite git history to GitHub noreply email (optional privacy)  
5. Real screenshots of the app in README  

---

## User preferences observed

- Wants fancy particles / music-reactive “alive” feel  
- Legal path only (no cracking Embers/SeeMusic)  
- Surprise me in **sidebar** under brand, **not** sticky, **not** full-width top bar  
- Save full-scene presets and premade lookbooks  
- Chiptune + SF2 sound options  

---

## Quick verification

```bash
npm run build   # must pass
npm run dev     # home → Launch visualizer → open MIDI → play
```

Smoke: change scene preset, change color palette mid-play (should **not** desync), load SF2 if available, toggle party mode briefly.
