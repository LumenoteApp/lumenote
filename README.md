<p align="center">
  <img src="docs/logo.svg" alt="Lumenote logo" width="72" height="72" />
</p>

<h1 align="center">Lumenote</h1>

<p align="center">
  <a href="https://lumenote.nl"><strong>Try it live → lumenote.nl</strong></a>
</p>

<p align="center">
  <strong>A MIDI piano visualizer that looks good out of the box.</strong><br />
  Play live with your keyboard, or turn a MIDI file into a video.<br />
  No watermark. No account. No install.
</p>

---

## What it does

- **Falling notes** over a full 88-key piano, with real bloom, a glow where keys are hit, and sparks.
- **Seven looks** (Midnight, Ember, Aurora, Sakura, Forest, Copper, Mono). Pick one, change the two hand colors if you like, done.
- **Three note styles**: Classic, Flame and Plasma.
- **Four sliders**: speed, glow, sparks and motion (how fast the haze, sparks, flames and plasma move). That's all the tuning there is.
- **Hands are colored automatically.** Two-track MIDI uses the tracks; a single-track piano transcription is split into left and right by pitch.
- **Live play** with any MIDI keyboard (Web MIDI), including the sustain pedal. Notes rise from the keys as you play. Pick one keyboard or all, and send what you play and the open song to a MIDI out (Pianoteq, a synth, a digital piano).
- **Piano sound**: sampled Salamander Grand, darker when you play softly.
- **Video export** to MP4 (H.264 + AAC): 16:9 or 9:16 (Shorts / Reels), 720p to 4K, 30 or 60 fps. Every frame is rendered at an exact timestep, so the video is smooth even on a slow machine.

Chrome or Edge recommended (Web MIDI + WebCodecs).

## Shortcuts

`Space` play / pause · `←` `→` seek 5 s · `F` fullscreen · `H` hide the interface

## Run it locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (http://localhost:5173). Production build: `npm run build`, output in `dist/`.

## Put it live (lumenote.nl)

1. Copy `.env.deploy.example` to `.env.deploy` and fill in the FTP details (same as FileZilla). This file is never committed.
2. Run `npm run deploy` (or double-click `Deploy Lumenote.bat`).

It builds, shows which files will change, asks before touching anything, downloads a backup of the live site to `backups/`, and then uploads. Options: `--dry` (only show the plan), `--yes` (no question), `--clean` (remove old build files from `assets/`).

## How it is built

| Part | File |
|------|------|
| MIDI parsing, hand split, sustain pedal | `src/midi.ts` |
| Looks and settings | `src/looks.ts` |
| WebGL2 renderer (notes, keys, sparks, bloom) | `src/render/Renderer.ts`, `src/render/shaders.ts` |
| Sampled piano (live and offline) | `src/audio/Piano.ts` |
| Song playback | `src/audio/Player.ts` |
| Web MIDI input | `src/live.ts` |
| Video export (Mediabunny) | `src/export.ts` |
| UI | `index.html`, `src/main.ts`, `src/style.css` |

The same `Renderer.frame(time, dt)` call draws the live view and every exported frame, so what you see is what you export.

### Export API

`exportVideo(song, settings, options)` returns an MP4 `Blob`. Besides size and fps it accepts:

- `startAt` / `maxSeconds`: render a clip (used for Shorts).
- `externalAudio`: an `AudioBuffer` aligned to song time 0 (for example a render from another piano engine) instead of the built-in piano.
- `overlay(ctx, { songTime, videoTime, duration })`: draw on top of every frame with Canvas 2D (titles and so on).

## Stack

Vite · TypeScript · WebGL2 · Web Audio · Web MIDI · [@tonejs/midi](https://github.com/Tonejs/Midi) · [Mediabunny](https://mediabunny.dev/)

Piano samples: Salamander Grand Piano by Alexander Holm (CC BY 3.0), via the Tone.js sample set.

## License

[MIT](LICENSE)
