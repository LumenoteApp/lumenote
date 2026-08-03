# Agent instructions (NoteFall)

You are working on **NoteFall**, a browser MIDI piano visualizer.

## Before coding

1. Read **`docs/SESSION_NOTES.md`** (handoff + decisions).  
2. Skim **`docs/ARCHITECTURE.md`** if touching engine/render.  
3. Project root: `C:\Users\Matt\projects\midi-visualizer`  
4. Remote: `https://github.com/UnSlopd/notefall`

## Hard rules

- Do **not** break playback reanchor / mute-only reschedule (color changes must not desync audio).  
- Do **not** start Web Audio / Tone until a user gesture.  
- Do **not** commit secrets, `.env`, or large private soundfonts.  
- Confirm before force-push, deploy, or destructive git.  
- Prefer small, focused diffs; match existing style.

## Verify

```bash
npm run build
```

## New session prompt (copy-paste)

```
Continue NoteFall (multi-track MIDI visualizer).
Path: C:\Users\Matt\projects\midi-visualizer
GitHub: https://github.com/UnSlopd/notefall
Read docs/SESSION_NOTES.md and docs/ARCHITECTURE.md first.
```
