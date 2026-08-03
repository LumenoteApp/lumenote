# Development guide

## Setup

```bash
git clone https://github.com/UnSlopd/lumenote.git
cd lumenote
npm install
npm run dev
```

Requirements: Node.js with npm; modern Chromium/Firefox/Edge recommended for SF2 worklet.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` - **must pass before push** |
| `npm run preview` | Serve production build |
| `npm run lint` | oxlint |

## Conventions

- Prefer editing existing modules over new frameworks.  
- Keep Tone/Spessa **lazy-loaded** after user gesture.  
- Never reschedule audio on color-only track updates.  
- When changing `VisualSettings` shape, update `hydrateSceneData` / defaults so old presets don’t break.  
- UI panels live under `src/ui/`; pure logic/presets under `src/theme/` and `src/engine/`.  
- Styles: mostly `App.css` + `HomePage.css` (no Tailwind required).  

## Adding a built-in instrument

1. Add id + metadata in `src/engine/instruments.ts` (`BUILTIN_INSTRUMENTS`).  
2. Implement `createToneInstrument` case **or** map to TinySynth quality/program.  
3. No SF2 binary in repo - user loads files locally.

## Adding a scene preset

Edit `BUILTIN_SCENE_PRESETS` in `src/theme/scenePresets.ts` via `makeBuiltIn(...)`.  
Include full settings + instrument + volume.

## SF2 worklet

After upgrading `spessasynth_lib`, re-copy:

```bash
copy node_modules\spessasynth_lib\dist\spessasynth_processor.min.js public\
```

Vite serves `public/` at site root.

## Git / GitHub

```bash
git remote -v
# origin → https://github.com/UnSlopd/lumenote.git

git status
git add -A
git commit -m "message"
git push origin master
```

`gh` CLI authenticated as **UnSlopd**.

## Do not

- Commit `node_modules/`, `dist/`, `.env`, secrets  
- Force-push `master` unless user explicitly asks  
- Reintroduce Embers/SeeMusic cracks or asset rips  
- Import Tone at module top level (AudioContext warnings / autoplay)  

## Debugging tips

| Symptom | Likely cause |
|---------|----------------|
| Audio silent until click | Expected autoplay policy - press Play |
| Desync after UI change | Accidental reschedule without reanchor |
| SF2 fails | Missing worklet file / large file / wrong path |
| Crash on color sliders | Missing `normalizeColorSettings` |
| Party overwrites look | Load preset without disabling party |
