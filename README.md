# NoteFall

Multi-track MIDI piano visualizer in the browser — falling notes, particles, music-reactive atmosphere, scene presets, and custom SF2 soundfonts. No watermark, no account.

## Features

- Multi-track colors (left/right hands, recolor, mute, hide)
- Particle systems with presets and full parameter control
- Music-reactive ambient field (streams, shockwaves, bass pulse)
- Background styles (nebula, aurora, starfield, pulse, grid…)
- RGB / rainbow color modes and track palettes
- **Surprise me** + **Party mode** (smooth parameter dancing)
- **Scene presets** — save/load full looks (localStorage + built-ins)
- Built-in instruments (piano, chiptune, pad, GM…) + **SF2/SF3** load
- Player fullscreen for clean recording (OBS / Game Bar)

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build
npm run preview
```

## Stack

- Vite + React + TypeScript
- `@tonejs/midi` · Tone.js · webaudio-tinysynth · spessasynth_lib (SF2)
- Canvas 2D rendering

## License

MIT
