# Agent instructions (Lumenote)

You are working on **Lumenote**, a browser MIDI piano visualizer.

## Before coding

1. If present, read **`docs/SESSION_NOTES.md`** (local handoff only - not on GitHub).  
2. Skim **`docs/ARCHITECTURE.md`** if touching engine/render.  
3. Project root: the clone of this repo (folder name may vary).  
4. Remote: `https://github.com/UnSlopd/lumenote`

## Hard rules

- Do **not** break playback reanchor / mute-only reschedule (color changes must not desync audio).  
- Do **not** start Web Audio / Tone until a user gesture.  
- Do **not** pass Tone's wrapped AudioContext into Spessa `WorkletSynthesizer` (use native context).  
- Keep live + bake painting in **`VisualizerEngine`** in sync.  
- Do **not** commit secrets, `.env`, large private soundfonts, or `docs/SESSION_NOTES.md`.  
- Confirm before force-push, deploy, or destructive git.  
- Prefer small, focused diffs; match existing style. No em dashes in user-facing copy.

## Verify

```bash
npm run build
```

## New session prompt (copy-paste)

```
Continue Lumenote (multi-track MIDI visualizer).
Clone: https://github.com/UnSlopd/lumenote
Read docs/ARCHITECTURE.md (and docs/SESSION_NOTES.md if it exists locally).
```
